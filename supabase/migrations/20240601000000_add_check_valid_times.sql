ALTER TABLE attendance ADD CONSTRAINT check_valid_times CHECK (check_in_time <= NOW() AND (check_out_time IS NULL OR check_out_time <= NOW()));
