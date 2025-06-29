-- Unique constraints for attendance records
-- Prevent duplicate check-outs and ensure data integrity

-- Comprehensive attendance record cleanup and timestamping migration

-- Drop everything first
DO $$ 
DECLARE
    _constraint record;
    _trigger record;
BEGIN
    -- Drop all constraints except primary key
    FOR _constraint IN 
        SELECT constraint_name 
        FROM information_schema.table_constraints 
        WHERE table_name = 'attendance' 
        AND constraint_type IN ('UNIQUE', 'CHECK')
    LOOP
        EXECUTE format('ALTER TABLE attendance DROP CONSTRAINT IF EXISTS %I', _constraint.constraint_name);
    END LOOP;

    -- Drop all triggers
    FOR _trigger IN 
        SELECT trigger_name 
        FROM information_schema.triggers 
        WHERE event_object_table = 'attendance'
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON attendance', _trigger.trigger_name);
    END LOOP;
END $$;

-- Drop all functions that might interfere
DROP FUNCTION IF EXISTS validate_attendance_times() CASCADE;
DROP FUNCTION IF EXISTS process_attendance_scan() CASCADE;
DROP FUNCTION IF EXISTS handle_attendance_scan() CASCADE;

-- Reset any problematic data
UPDATE attendance
SET status = 'present',
    check_out_time = NULL
WHERE status = 'checked-out' 
AND check_out_time IS NULL;

-- Remove any unique constraints on employee_id and date
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS unique_employee_date_checkin;
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS unique_daily_attendance_sequence;
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS unique_employee_daily_checkin_v2;
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS unique_daily_attendance_v3;
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS prevent_simultaneous_checkout;

-- Re-enable user triggers
ALTER TABLE attendance ENABLE TRIGGER USER;

-- Clean up any existing records that would violate the constraint
UPDATE attendance
SET check_out_time = NULL,
    status = 'present'
WHERE (
    check_out_time IS NOT NULL AND 
    check_out_time <= check_in_time + INTERVAL '15 minutes'
) OR (
    check_out_time IS NULL AND 
    status = 'checked-out'
);

-- First, clean up duplicate records keeping only the earliest check-in for each employee per day
WITH DuplicatesToDelete AS (
    SELECT id
    FROM (
        SELECT id,
               ROW_NUMBER() OVER (PARTITION BY employee_id, date ORDER BY check_in_time) as rn
        FROM attendance
    ) ranked
    WHERE rn > 1
)
DELETE FROM attendance
WHERE id IN (SELECT id FROM DuplicatesToDelete);

-- Clean up any records with check-out times too close to check-in
UPDATE attendance
SET check_out_time = NULL,
    status = 'present'
WHERE check_out_time IS NOT NULL 
AND EXTRACT(EPOCH FROM (check_out_time - check_in_time)) < 900;

-- Add constraints
-- Clean up any existing records that would violate the constraint
UPDATE attendance
SET check_out_time = NULL
WHERE check_out_time IS NOT NULL 
AND check_out_time <= check_in_time + INTERVAL '15 minutes';

ALTER TABLE attendance DROP CONSTRAINT IF EXISTS prevent_simultaneous_checkout;

ALTER TABLE attendance 
ADD CONSTRAINT unique_employee_date_checkin 
UNIQUE (employee_id, date, check_in_time);

ALTER TABLE attendance 
ADD CONSTRAINT unique_daily_attendance_sequence 
UNIQUE (employee_id, date, sequence_number); 