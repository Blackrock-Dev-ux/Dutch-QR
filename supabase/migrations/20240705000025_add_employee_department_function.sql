-- Create a function to get employees with their departments
CREATE OR REPLACE FUNCTION get_employees_with_departments()
RETURNS TABLE (
    id uuid,
    name text,
    first_name text,
    last_name text,
    email text,
    phone text,
    "position" text,
    status text,
    join_date date,
    department_name text
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.id,
        e.name,
        e.first_name,
        e.last_name,
        e.email,
        e.phone,
        e."position",
        e.status,
        e.join_date,
        d.name as department_name
    FROM 
        employees e
        LEFT JOIN departments d ON d.id = e.department_id
    WHERE 
        e.status = 'active';
END;
$$; 