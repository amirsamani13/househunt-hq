-- Clear fake/test data from properties table to start fresh with real data
DELETE FROM properties WHERE 
  title LIKE '%Test Property%' OR 
  title LIKE '%Apartment 1 - Groningen Center%' OR 
  title LIKE '%Apartment 2 - Groningen Center%' OR 
  title LIKE '%Apartment 3 - Groningen Center%' OR
  title LIKE '%Student Room % - Near University%' OR
  title LIKE '%Modern Apartment % - City Center%' OR
  address LIKE '%Teststraat%' OR
  address LIKE '%Centrum %, 9712%' OR
  address LIKE '%Studentenstraat%';