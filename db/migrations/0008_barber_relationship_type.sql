-- Classifies each professional as an employee or a partner.
ALTER TABLE barbers ADD COLUMN barber_type TEXT NOT NULL DEFAULT 'EMPLOYEE'
  CHECK (barber_type IN ('EMPLOYEE', 'PARTNER'));
