-- FinanControl: esquema de la base de datos (MySQL 8)
-- Uso:  mysql -u root -p < docs/schema.sql

CREATE DATABASE IF NOT EXISTS financontrol
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE financontrol;

CREATE TABLE IF NOT EXISTS usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  correo VARCHAR(150) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS ingresos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  descripcion VARCHAR(255) NOT NULL,
  valor DECIMAL(12,2) NOT NULL,
  fecha DATE NOT NULL,
  usuario_id INT NOT NULL,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  INDEX idx_ingresos_usuario_fecha (usuario_id, fecha)
);

CREATE TABLE IF NOT EXISTS gastos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  descripcion VARCHAR(255) NOT NULL,
  valor DECIMAL(12,2) NOT NULL,
  categoria VARCHAR(100) NOT NULL,
  fecha DATE NOT NULL,
  usuario_id INT NOT NULL,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  INDEX idx_gastos_usuario_fecha (usuario_id, fecha),
  INDEX idx_gastos_usuario_categoria (usuario_id, categoria)
);
