-- backend/schema.sql

-- Enable UUID generation if not already enabled
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; -- Alternative using uuid-ossp
-- Or ensure pgcrypto is enabled if using gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Users Table: Stores user authentication and profile information
CREATE TABLE IF NOT EXISTS users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(), -- Use UUID for primary key
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL, -- Store the bcrypt hash
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP -- Automatically updated by trigger
);

-- Index on email for faster logins/registration checks
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Projects Table: Stores project metadata, linked to users
CREATE TABLE IF NOT EXISTS projects (
    project_id SERIAL PRIMARY KEY, -- Auto-incrementing integer ID for projects
    user_id UUID NOT NULL,         -- Foreign key referencing the owner user's UUID
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(), -- Automatically updated by trigger
    CONSTRAINT fk_user
        FOREIGN KEY(user_id)
        REFERENCES users(user_id)
        ON DELETE CASCADE -- If a user is deleted, their projects are also deleted
);

-- Index on user_id for faster project lookups by user
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);

-- Files Table: Stores file metadata and content, linked to projects
CREATE TABLE IF NOT EXISTS files (
    file_id SERIAL PRIMARY KEY,     -- Auto-incrementing integer ID for files
    project_id INT NOT NULL,        -- Foreign key referencing the parent project's integer ID
    name VARCHAR(255) NOT NULL,
    path TEXT DEFAULT '/',          -- Represents the directory path within the project
    file_type VARCHAR(50) DEFAULT 'markdown', -- e.g., 'markdown', 'fountain', 'note'
    content TEXT,                   -- The actual content of the file
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(), -- Automatically updated by trigger
    CONSTRAINT fk_project
        FOREIGN KEY(project_id)
        REFERENCES projects(project_id)
        ON DELETE CASCADE -- If a project is deleted, delete its files too
);

-- Index on project_id for faster file lookups by project
CREATE INDEX IF NOT EXISTS idx_files_project_id ON files(project_id);


-- Trigger function to automatically update `updated_at` timestamps
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to 'users' table
CREATE TRIGGER set_timestamp_users
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Apply trigger to 'projects' table
CREATE TRIGGER set_timestamp_projects
BEFORE UPDATE ON projects
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Apply trigger to 'files' table
CREATE TRIGGER set_timestamp_files
BEFORE UPDATE ON files
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp(); 