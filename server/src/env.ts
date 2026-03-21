// Load environment variables BEFORE any other imports
// This must be the very first module loaded so that all subsequent
// imports (database, config, etc.) can access process.env values.
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../..', '.env') });

export {};
