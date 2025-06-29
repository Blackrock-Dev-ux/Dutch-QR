-- Add default departments
INSERT INTO departments (name, created_at, updated_at)
VALUES 
    ('IT', NOW(), NOW()),
    ('HR', NOW(), NOW()),
    ('Finance', NOW(), NOW()),
    ('Marketing', NOW(), NOW()),
    ('Sales', NOW(), NOW()),
    ('Operations', NOW(), NOW()),
    ('Engineering', NOW(), NOW()),
    ('Research', NOW(), NOW()),
    ('Development', NOW(), NOW()),
    ('Customer Service', NOW(), NOW()),
    ('Administration', NOW(), NOW()),
    ('Transport', NOW(), NOW()),
    ('Maintenance', NOW(), NOW()),
    ('Security', NOW(), NOW()),
    ('Dutch Activity', NOW(), NOW()),
    ('Kitchen', NOW(), NOW()),
    ('Food & Beverage Department', NOW(), NOW()),
    ('Butchery', NOW(), NOW()),
    ('Reservations', NOW(), NOW()),
    ('House Keeping', NOW(), NOW()),
    ('Pastry Kitchen', NOW(), NOW()),
    ('Stores', NOW(), NOW()),
    ('Purchasing & Stores', NOW(), NOW()),
    ('Accounts Department', NOW(), NOW())
ON CONFLICT (name) DO NOTHING; 