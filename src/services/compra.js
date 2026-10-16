function calcularTotalCompra(precio, cantidad) {
    if (precio < 0 || cantidad <= 0) {
        return 0;
    }

    return precio * cantidad;
}

module.exports = calcularTotalCompra;