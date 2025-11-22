#!/usr/bin/env python3
import subprocess
import time
import sys
import getpass
import mysql.connector
from mysql.connector import Error

DOCKER_CONTAINER_NAME = "chatapp-mysql"
MYSQL_IMAGE = "mysql:8.0"
MYSQL_PORT = 3306

def print_banner():
    print("\n" + "="*60)
    print("  REAL-TIME CHAT APPLICATION - DATABASE SETUP WIZARD")
    print("="*60 + "\n")

def check_docker():
    """Check if Docker is installed and accessible"""
    try:
        subprocess.run(["docker", "info"], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except FileNotFoundError:
        print("❌ Docker is not installed or not in PATH.")
        sys.exit(1)
    except subprocess.CalledProcessError:
        print("❌ Docker daemon is not running. Start Docker Desktop and try again.")
        sys.exit(1)

def start_mysql_container(root_password, db_name):
    """Start MySQL container using Docker"""
    # Check if container already exists
    result = subprocess.run(["docker", "ps", "-a", "--filter", f"name={DOCKER_CONTAINER_NAME}", "--format", "{{.Names}}"], capture_output=True, text=True)
    if DOCKER_CONTAINER_NAME in result.stdout.strip():
        # Start the container if it exists but not running
        subprocess.run(["docker", "start", DOCKER_CONTAINER_NAME], check=True)
        print(f"✅ Started existing MySQL container: {DOCKER_CONTAINER_NAME}")
    else:
        # Run a new container
        subprocess.run([
            "docker", "run", "--name", DOCKER_CONTAINER_NAME,
            "-e", f"MYSQL_ROOT_PASSWORD={root_password}",
            "-e", f"MYSQL_DATABASE={db_name}",
            "-p", f"{MYSQL_PORT}:3306",
            "-d", MYSQL_IMAGE
        ], check=True)
        print(f"✅ Created and started MySQL container: {DOCKER_CONTAINER_NAME}")

def wait_for_mysql(host, port, user, password, retries=30, delay=5):
    """Wait until MySQL is ready to accept connections"""
    print("\n[MySQL] Waiting for server to be ready...")
    for attempt in range(1, retries+1):
        try:
            conn = mysql.connector.connect(
                host=host,
                port=port,
                user=user,
                password=password
            )
            conn.close()
            print(f"✅ MySQL is ready (attempt {attempt})")
            return True
        except Error:
            print(f"[MySQL] Waiting... ({attempt}/{retries})")
            time.sleep(delay)
    print("❌ Unable to connect to MySQL server after multiple attempts.")
    sys.exit(1)

def get_database_credentials():
    print("="*60)
    print("STEP 1: MySQL Configuration")
    print("="*60 + "\n")
    
    host = input("MySQL Host (default: localhost): ").strip() or "localhost"
    port = input(f"MySQL Port (default: {MYSQL_PORT}): ").strip() or str(MYSQL_PORT)
    
    print("\nEnter MySQL credentials (root user for Docker container):")
    user = input("MySQL Username (default: root): ").strip() or "root"
    password = getpass.getpass("MySQL Password (used to secure Docker MySQL): ")
    
    db_name = input("Database Name (default: chatapp): ").strip() or "chatapp"
    
    print("\n" + "="*60)
    print("CONFIGURATION SUMMARY")
    print("="*60)
    print(f"MySQL Host:     {host}")
    print(f"MySQL Port:     {port}")
    print(f"MySQL User:     {user}")
    print(f"Password:       {'*'*len(password)}")
    print(f"Database Name:  {db_name}")
    print("="*60 + "\n")
    
    confirm = input("Proceed with these settings? (yes/no): ").strip().lower()
    if confirm not in ["yes", "y"]:
        print("❌ Setup cancelled by user.")
        sys.exit(0)
    
    return host, port, user, password, db_name

def create_database_and_tables(host, port, user, password, db_name):
    """Create database and tables"""
    connection = None
    cursor = None
    try:
        print("\n[1/6] Connecting to MySQL server...")
        connection = mysql.connector.connect(host=host, port=port, user=user, password=password)
        cursor = connection.cursor()
        print("✅ Connected successfully!")

        print(f"\n[2/6] Creating database '{db_name}'...")
        cursor.execute(f"CREATE DATABASE IF NOT EXISTS {db_name}")
        cursor.execute(f"USE {db_name}")
        print(f"✅ Database '{db_name}' created/selected!")

        # Users table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS Users (
                user_id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_seen TIMESTAMP NULL,
                is_online BOOLEAN DEFAULT FALSE,
                INDEX idx_username (username),
                INDEX idx_email (email)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """)
        print("✅ Users table created!")

        # DirectMessages table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS DirectMessages (
                message_id INT AUTO_INCREMENT PRIMARY KEY,
                sender_id INT NOT NULL,
                receiver_id INT NOT NULL,
                message_text TEXT NOT NULL,
                sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_read BOOLEAN DEFAULT FALSE,
                FOREIGN KEY (sender_id) REFERENCES Users(user_id) ON DELETE CASCADE,
                FOREIGN KEY (receiver_id) REFERENCES Users(user_id) ON DELETE CASCADE,
                INDEX idx_sender (sender_id),
                INDEX idx_receiver (receiver_id),
                INDEX idx_conversation (sender_id, receiver_id, sent_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """)
        print("✅ DirectMessages table created!")

        # `Groups` and GroupMembers
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS `Groups` (
                group_id INT AUTO_INCREMENT PRIMARY KEY,
                group_name VARCHAR(100) NOT NULL,
                created_by INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                description TEXT,
                FOREIGN KEY (created_by) REFERENCES Users(user_id) ON DELETE CASCADE,
                INDEX idx_creator (created_by)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS GroupMembers (
                membership_id INT AUTO_INCREMENT PRIMARY KEY,
                group_id INT NOT NULL,
                user_id INT NOT NULL,
                joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                role ENUM('admin', 'member') DEFAULT 'member',
                FOREIGN KEY (group_id) REFERENCES `Groups`(group_id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
                UNIQUE KEY unique_membership (group_id, user_id),
                INDEX idx_group (group_id),
                INDEX idx_user (user_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """)
        print("✅ `Groups` and GroupMembers tables created!")

        # GroupMessages table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS GroupMessages (
                message_id INT AUTO_INCREMENT PRIMARY KEY,
                group_id INT NOT NULL,
                sender_id INT NOT NULL,
                message_text TEXT NOT NULL,
                sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (group_id) REFERENCES `Groups`(group_id) ON DELETE CASCADE,
                FOREIGN KEY (sender_id) REFERENCES Users(user_id) ON DELETE CASCADE,
                INDEX idx_group (group_id),
                INDEX idx_sender (sender_id),
                INDEX idx_group_time (group_id, sent_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """)
        print("✅ GroupMessages table created!")

        connection.commit()
        print("\n🎉 DATABASE SETUP COMPLETED SUCCESSFULLY!\n")
        print("Add the following to your backend .env file:")
        print(f"DB_HOST={host}")
        print(f"DB_PORT={port}")
        print(f"DB_USER={user}")
        print(f"DB_PASSWORD={password}")
        print(f"DB_NAME={db_name}")

    except Error as e:
        print(f"\n❌ Error: {e}")
        if connection:
            connection.rollback()
    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()

def main():
    print_banner()
    check_docker()
    host, port, user, password, db_name = get_database_credentials()
    start_mysql_container(password, db_name)
    wait_for_mysql(host, port, user, password)
    create_database_and_tables(host, port, user, password, db_name)

if __name__ == "__main__":
    main()
