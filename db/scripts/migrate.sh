#!/bin/bash

# 数据库迁移脚本
echo "Starting database migration..."

# 执行迁移
mysql -u root -p$MYSQL_ROOT_PASSWORD < ./init/01-create-database.sql
mysql -u root -p$MYSQL_ROOT_PASSWORD sign_language < ./init/02-create-tables.sql
mysql -u root -p$MYSQL_ROOT_PASSWORD sign_language < ./init/03-insert-demo-data.sql

echo "Migration completed!"