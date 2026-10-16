const calcularTotalCompra = require('../src/services/compra');

test('calcula correctamente una compra de dos productos', () => {
    expect(calcularTotalCompra(10000, 2)).toBe(20000);
});

test('devuelve 0 cuando el precio es negativo', () => {
    expect(calcularTotalCompra(-5000, 2)).toBe(0);
});

test('calcula correctamente una compra de un solo producto', () => {
    expect(calcularTotalCompra(15000, 1)).toBe(15000);
});