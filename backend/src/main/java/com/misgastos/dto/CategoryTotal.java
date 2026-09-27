package com.misgastos.dto;

import com.misgastos.model.Category;

import java.math.BigDecimal;

/** Total de una categoría y su porcentaje sobre el total del período. */
public record CategoryTotal(Category category, BigDecimal total, BigDecimal percent, int count) {
}
