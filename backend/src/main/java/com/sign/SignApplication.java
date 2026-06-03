// backend/src/main/java/com/sign/SignApplication.java
package com.sign;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
@SpringBootApplication
public class SignApplication {
    public static void main(String[] args) {
        SpringApplication.run(SignApplication.class, args);
        System.out.println("========================================");
        System.out.println("智能手语翻译系统 - Java后端");
        System.out.println("服务地址: http://localhost:8080");
        System.out.println("前端地址: http://localhost:3000/about.html");
        System.out.println("========================================");
    }
}