FROM mysql:8.0

ENV MYSQL_ROOT_PASSWORD=root123456
ENV MYSQL_DATABASE=sign_language
ENV MYSQL_USER=sign_user
ENV MYSQL_PASSWORD=sign_password

COPY ./init /docker-entrypoint-initdb.d
COPY ./scripts /scripts

EXPOSE 3306