-- Drop the department column from rosters if it exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'rosters'
        AND column_name = 'department'
    ) THEN
        ALTER TABLE rosters DROP COLUMN department;
    END IF;
END $$;

-- Add department_id to rosters if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'rosters'
        AND column_name = 'department_id'
    ) THEN
        ALTER TABLE rosters ADD COLUMN department_id UUID REFERENCES departments(id);
    END IF;
END $$;

-- Drop any duplicate foreign key constraints
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT constraint_name 
        FROM information_schema.table_constraints 
        WHERE table_name = 'employees' 
        AND constraint_type = 'FOREIGN KEY'
        AND constraint_name LIKE '%department%'
    ) LOOP
        EXECUTE 'ALTER TABLE employees DROP CONSTRAINT IF EXISTS ' || r.constraint_name;
    END LOOP;
END $$;

-- Add back the single correct foreign key constraint
ALTER TABLE employees
    ADD CONSTRAINT employees_department_id_fkey 
    FOREIGN KEY (department_id) 
    REFERENCES departments(id);

-- Create index for the foreign key
CREATE INDEX IF NOT EXISTS idx_employees_department_id ON employees(department_id);
CREATE INDEX IF NOT EXISTS idx_rosters_department_id ON rosters(department_id); 