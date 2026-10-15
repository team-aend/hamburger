'use client';

import { useMemo, useState } from 'react';
import { ALL_BRANDS } from '@/data/brands';
import type { PattyType, Product, SortType } from '@/types/product';

export const ALL_PATTY = 'ALL';

export type BrandFilterValue = typeof ALL_BRANDS | string;
export type PattyFilterValue = typeof ALL_PATTY | PattyType;

function sortProducts(products: Product[], sortType: SortType): Product[] {
  const sorted = [...products];

  switch (sortType) {
    case 'PRICE_ASC':
      return sorted.sort((a, b) => a.singlePrice - b.singlePrice);
    case 'PRICE_DESC':
      return sorted.sort((a, b) => b.singlePrice - a.singlePrice);
    case 'CALORIES_ASC':
      return sorted.sort(
        (a, b) => (a.calories ?? Infinity) - (b.calories ?? Infinity)
      );
    case 'PROTEIN_DESC':
      return sorted.sort((a, b) => (b.protein ?? -1) - (a.protein ?? -1));
    case 'PROTEIN_EFFICIENCY_DESC':
      return sorted.sort((a, b) => {
        const effA = a.protein && a.singlePrice ? a.protein / a.singlePrice : -1;
        const effB = b.protein && b.singlePrice ? b.protein / b.singlePrice : -1;
        return effB - effA;
      });
    default:
      return sorted;
  }
}

export function useProductFilters(products: Product[]) {
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedBrand, setSelectedBrand] =
    useState<BrandFilterValue>(ALL_BRANDS);
  const [selectedPattyType, setSelectedPattyType] =
    useState<PattyFilterValue>(ALL_PATTY);
  const [sortType, setSortType] = useState<SortType>('DEFAULT');

  const filteredProducts = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();

    const filtered = products.filter((product) => {
      const matchesKeyword =
        keyword === '' ||
        product.name.toLowerCase().includes(keyword) ||
        product.brand.name.toLowerCase().includes(keyword);

      const matchesBrand =
        selectedBrand === ALL_BRANDS || product.brand.slug === selectedBrand;

      const matchesPatty =
        selectedPattyType === ALL_PATTY ||
        product.pattyType === selectedPattyType;

      return matchesKeyword && matchesBrand && matchesPatty;
    });

    return sortProducts(filtered, sortType);
  }, [products, searchKeyword, selectedBrand, selectedPattyType, sortType]);

  const isFiltered =
    searchKeyword.trim() !== '' ||
    selectedBrand !== ALL_BRANDS ||
    selectedPattyType !== ALL_PATTY;

  const resetFilters = () => {
    setSearchKeyword('');
    setSelectedBrand(ALL_BRANDS);
    setSelectedPattyType(ALL_PATTY);
    setSortType('DEFAULT');
  };

  return {
    searchKeyword,
    setSearchKeyword,
    selectedBrand,
    setSelectedBrand,
    selectedPattyType,
    setSelectedPattyType,
    sortType,
    setSortType,
    filteredProducts,
    isFiltered,
    resetFilters,
  };
}
