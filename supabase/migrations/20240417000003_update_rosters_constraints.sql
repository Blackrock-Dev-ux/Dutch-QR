-- Make department and position columns nullable
ALTER TABLE rosters ALTER COLUMN department DROP NOT NULL;
ALTER TABLE rosters ALTER COLUMN position DROP NOT NULL;

-- Update existing null values to a default value if needed
UPDATE rosters 
SET department = 'Unassigned'
WHERE department IS NULL;

-- Add a comment explaining the nullable columns
COMMENT ON COLUMN rosters.department IS 'Department the roster is associated with (nullable)';
COMMENT ON COLUMN rosters.position IS 'Position/role in the department (nullable)'; 