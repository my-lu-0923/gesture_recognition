#!/bin/bash

# 数据库恢复脚本
BACKUP_FILE=$1
DB_NAME="sign_language"
DB_USER="root"
DB_PASSWORD="root123456"

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: ./restore.sh <backup_file>"
    exit 1
fi

# 解压并恢复
gunzip -c $BACKUP_FILE | mysql -u $DB_USER -p$DB_PASSWORD $DB_NAME

echo "Restore completed from: $BACKUP_FILE"