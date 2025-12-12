-- Rename isPrimary column to isAccountOwner in dealer_contacts table
-- This better reflects that this flag indicates the account owner contact

ALTER TABLE dealer_contacts RENAME COLUMN "isPrimary" TO "isAccountOwner";
