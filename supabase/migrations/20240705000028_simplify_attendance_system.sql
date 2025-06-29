-- First, backup existing data
CREATE TABLE IF NOT EXISTS attendance_backup AS SELECT * FROM attendance;

-- Drop dependent views first
DROP VIEW IF EXISTS attendance_reports CASCADE;
DROP VIEW IF EXISTS employee_attendance_summary CASCADE;
DROP VIEW IF EXISTS daily_attendance_summary CASCADE;
DROP VIEW IF EXISTS monthly_attendance_summary CASCADE;
DROP MATERIALIZED VIEW IF EXISTS attendance_metrics CASCADE;

-- Drop existing constraints and triggers
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS check_session_times;
DROP TRIGGER IF EXISTS session_validation_trigger ON attendance;
DROP TRIGGER IF EXISTS second_session_validation_trigger ON attendance;
DROP INDEX IF EXISTS unique_employee_date_session_checkin;
DROP INDEX IF EXISTS unique_employee_date_session;
DROP INDEX IF EXISTS idx_attendance_employee_date;

-- Drop functions we no longer need
DROP FUNCTION IF EXISTS validate_session_record();
DROP FUNCTION IF EXISTS validate_second_session();
DROP FUNCTION IF EXISTS create_second_session(UUID, UUID);
DROP FUNCTION IF EXISTS calculate_working_time(TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS calculate_working_time(TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS calculate_working_time(UUID);
DROP FUNCTION IF EXISTS handle_attendance_action(UUID, TEXT);

-- Clean up the attendance table structure
ALTER TABLE attendance
    DROP COLUMN IF EXISTS is_second_session,
    DROP COLUMN IF EXISTS previous_session_id,
    DROP COLUMN IF EXISTS second_check_in_time,
    DROP COLUMN IF EXISTS second_check_out_time,
    DROP COLUMN IF EXISTS sequence_number,
    ALTER COLUMN status TYPE TEXT,
    ALTER COLUMN status SET DEFAULT 'PENDING';

-- Add new columns for simplified approach
DO $$
BEGIN
    BEGIN
        ALTER TABLE attendance ADD COLUMN check_in_time TIMESTAMPTZ;
    EXCEPTION
        WHEN duplicate_column THEN NULL;
    END;

    BEGIN
        ALTER TABLE attendance ADD COLUMN check_out_time TIMESTAMPTZ;
    EXCEPTION
        WHEN duplicate_column THEN NULL;
    END;

    BEGIN
        ALTER TABLE attendance ADD COLUMN break_start_time TIMESTAMPTZ;
    EXCEPTION
        WHEN duplicate_column THEN NULL;
    END;

    BEGIN
        ALTER TABLE attendance ADD COLUMN break_end_time TIMESTAMPTZ;
    EXCEPTION
        WHEN duplicate_column THEN NULL;
    END;

    BEGIN
        ALTER TABLE attendance ADD COLUMN total_working_minutes INTEGER DEFAULT 0;
    EXCEPTION
        WHEN duplicate_column THEN NULL;
    END;

    BEGIN
        ALTER TABLE attendance ADD COLUMN break_duration_minutes INTEGER DEFAULT 0;
    EXCEPTION
        WHEN duplicate_column THEN NULL;
    END;

    BEGIN
        ALTER TABLE attendance ADD COLUMN device_info TEXT;
    EXCEPTION
        WHEN duplicate_column THEN NULL;
    END;

    BEGIN
        ALTER TABLE attendance ADD COLUMN location TEXT;
    EXCEPTION
        WHEN duplicate_column THEN NULL;
    END;

    BEGIN
        ALTER TABLE attendance ADD COLUMN minutes_late INTEGER DEFAULT 0;
    EXCEPTION
        WHEN duplicate_column THEN NULL;
    END;

    BEGIN
        ALTER TABLE attendance ADD COLUMN early_departure BOOLEAN DEFAULT false;
    EXCEPTION
        WHEN duplicate_column THEN NULL;
    END;

    BEGIN
        ALTER TABLE attendance ADD COLUMN overtime_minutes INTEGER DEFAULT 0;
    EXCEPTION
        WHEN duplicate_column THEN NULL;
    END;
END $$;

-- Create a function to calculate working time with explicit parameter names and types
CREATE OR REPLACE FUNCTION calculate_working_time(
    p_check_in_time TIMESTAMPTZ,
    p_check_out_time TIMESTAMPTZ,
    p_break_start_time TIMESTAMPTZ,
    p_break_end_time TIMESTAMPTZ
) RETURNS INTEGER AS $$
DECLARE
    v_total_minutes INTEGER;
    v_break_minutes INTEGER;
BEGIN
    -- If no check-out, use current time
    p_check_out_time := COALESCE(p_check_out_time, NOW());
    
    -- Calculate total duration
    v_total_minutes := EXTRACT(EPOCH FROM (p_check_out_time - p_check_in_time))/60;
    
    -- Calculate break duration if applicable
    IF p_break_start_time IS NOT NULL AND p_break_end_time IS NOT NULL THEN
        v_break_minutes := EXTRACT(EPOCH FROM (p_break_end_time - p_break_start_time))/60;
        v_total_minutes := v_total_minutes - v_break_minutes;
    END IF;
    
    RETURN GREATEST(v_total_minutes, 0);
END;
$$ LANGUAGE plpgsql;

-- Create a function to handle attendance actions with explicit parameter names
CREATE OR REPLACE FUNCTION handle_attendance_action(
    p_employee_id UUID,
    p_action TEXT -- 'CHECK_IN', 'START_BREAK', 'END_BREAK', 'CHECK_OUT'
) RETURNS attendance AS $$
DECLARE
    v_record attendance;
    v_now TIMESTAMPTZ := NOW();
    v_today DATE := CURRENT_DATE;
BEGIN
    -- Get existing record for today
    SELECT * INTO v_record
    FROM attendance
    WHERE employee_id = p_employee_id
    AND date = v_today;
    
    -- Handle each action
    CASE p_action
        WHEN 'CHECK_IN' THEN
            IF v_record.id IS NULL THEN
                -- Create new record
                INSERT INTO attendance (
                    employee_id, date, check_in_time,
                    status, device_info, location
                ) VALUES (
                    p_employee_id, v_today, v_now,
                    'CHECKED_IN', 'Web Browser', 'Office'
                ) RETURNING * INTO v_record;
            ELSE
                RAISE EXCEPTION 'Already checked in today';
            END IF;
            
        WHEN 'START_BREAK' THEN
            IF v_record.id IS NULL THEN
                RAISE EXCEPTION 'Must check in first';
            ELSIF v_record.break_start_time IS NOT NULL AND v_record.break_end_time IS NULL THEN
                RAISE EXCEPTION 'Break already started';
            ELSIF v_record.check_out_time IS NOT NULL THEN
                RAISE EXCEPTION 'Already checked out';
            ELSE
                UPDATE attendance
                SET break_start_time = v_now,
                    status = 'ON_BREAK'
                WHERE id = v_record.id
                RETURNING * INTO v_record;
            END IF;
            
        WHEN 'END_BREAK' THEN
            IF v_record.break_start_time IS NULL THEN
                RAISE EXCEPTION 'Break not started';
            ELSIF v_record.break_end_time IS NOT NULL THEN
                RAISE EXCEPTION 'Break already ended';
            ELSE
                UPDATE attendance
                SET break_end_time = v_now,
                    status = 'CHECKED_IN',
                    break_duration_minutes = EXTRACT(EPOCH FROM (v_now - break_start_time))/60
                WHERE id = v_record.id
                RETURNING * INTO v_record;
            END IF;
            
        WHEN 'CHECK_OUT' THEN
            IF v_record.id IS NULL THEN
                RAISE EXCEPTION 'Must check in first';
            ELSIF v_record.check_out_time IS NOT NULL THEN
                RAISE EXCEPTION 'Already checked out';
            ELSIF v_record.break_start_time IS NOT NULL AND v_record.break_end_time IS NULL THEN
                RAISE EXCEPTION 'Must end break before checking out';
            ELSE
                -- Calculate total working time
                UPDATE attendance
                SET check_out_time = v_now,
                    status = 'CHECKED_OUT',
                    total_working_minutes = calculate_working_time(
                        check_in_time,
                        v_now,
                        break_start_time,
                        break_end_time
                    ),
                    overtime_minutes = GREATEST(
                        calculate_working_time(
                            check_in_time,
                            v_now,
                            break_start_time,
                            break_end_time
                        ) - 480, -- 8 hours in minutes
                        0
                    )
                WHERE id = v_record.id
                RETURNING * INTO v_record;
            END IF;
        ELSE
            RAISE EXCEPTION 'Invalid action: %. Valid actions are: CHECK_IN, START_BREAK, END_BREAK, CHECK_OUT', p_action;
    END CASE;
    
    RETURN v_record;
END;
$$ LANGUAGE plpgsql;

-- Drop existing unique constraint if it exists
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS unique_daily_attendance;

-- Create a unique constraint for one record per employee per day
ALTER TABLE attendance
ADD CONSTRAINT unique_daily_attendance UNIQUE (employee_id, date);

-- Create an index for faster lookups (with IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_attendance_employee_date ON attendance (employee_id, date);

-- Recreate the attendance reports view with the new schema
CREATE OR REPLACE VIEW attendance_reports AS
SELECT 
    a.id,
    a.employee_id,
    e.name as employee_name,
    a.date,
    a.check_in_time,
    a.check_out_time,
    a.break_start_time,
    a.break_end_time,
    a.total_working_minutes,
    a.break_duration_minutes,
    a.status,
    a.minutes_late,
    a.early_departure,
    a.overtime_minutes,
    d.name as department_name
FROM attendance a
LEFT JOIN employees e ON a.employee_id = e.id
LEFT JOIN departments d ON e.department_id = d.id;

-- Add helpful comments
COMMENT ON FUNCTION calculate_working_time(TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ) IS 
'Calculates total working time accounting for breaks';

COMMENT ON FUNCTION handle_attendance_action(UUID, TEXT) IS 
'Handles all attendance actions (check-in, break start/end, check-out) with proper validation'; 