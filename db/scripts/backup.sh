#!/bin/bash

# 数据库备份脚本
BACKUP_DIR="./backups"
DB_NAME="sign_language"
DB_USER="root"
DB_PASSWORD="root123456"
DATE=$(date +"%Y%m%d_%H%M%S")

# 创建备份目录
mkdir -p $BACKUP_DIR

# 备份数据库
mysqldump -u $DB_USER -p$DB_PASSWORD $DB_NAME > "$BACKUP_DIR/${DB_NAME}_backup_${DATE}.sql"

# 压缩备份文件
gzip "$BACKUP_DIR/${DB_NAME}_backup_${DATE}.sql"

# 删除7天前的备份
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete

echo "Backup completed: ${DB_NAME}_backup_${DATE}.sql.gz"