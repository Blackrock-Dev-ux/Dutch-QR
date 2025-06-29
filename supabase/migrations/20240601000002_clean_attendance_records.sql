-- Clean up attendance records with invalid check-out times
UPDATE attendance 
SET check_out_time = NULL 
WHERE check_out_time IS NOT NULL AND check_out_time < check_in_time;

-- Ensure all records have a valid date
UPDATE attendance 
SET date = DATE(check_in_time) 
WHERE date IS NULL OR date != DATE(check_in_time); 