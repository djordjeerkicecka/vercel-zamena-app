import { shopifyGraphQL } from "./client";
import { SIZE_OPTION_PATTERN, COLOR_OPTION_PATTERN, parseSizeValue } from "./sizeUtils";
import type {
  ProductListItemDTO,
  ProductVariantOptionDTO,
  ProductVariantsResultDTO,
} from "../types";

const PRODUCT_VARIANTS_QUERY = /* GraphQL */ `
  query ProductVariants($id: ID!) {
    product(id: $id) {
      id
      options {
        name
        values
      }
      variants(first: 100) {
        edges {
          node {
            id
            title
            sku
            barcode
            availableForSale
            inventoryQuantity
            selectedOptions {
              name
              value
            }
          }
        }
      }
    }
  }
`;

interface ProductVariantsQueryResult {
  product: {
    id: string;
    options: { name: string; values: string[] }[];
    variants: {
      edges: {
        node: {
          id: string;
          title: string;
          sku: string | null;
          barcode: string | null;
          availableForSale: boolean;
          inventoryQuantity: number | null;
          selectedOptions: { name: string; value: string }[];
        };
      }[];
    };
  } | null;
}

export async function getProductVariantsWithInventory(
  productId: string
): Promise<ProductVariantsResultDTO> {
  const data = await shopifyGraphQL<ProductVariantsQueryResult>(PRODUCT_VARIANTS_QUERY, {
    id: productId,
  });

  if (!data.product) {
    throw new Error("Proizvod nije pronađen u Shopify-u.");
  }

  const sizeOptionName = data.product.options.find((o) => SIZE_OPTION_PATTERN.test(o.name))?.name;
  const colorOptionName = data.product.options.find((o) => COLOR_OPTION_PATTERN.test(o.name))?.name;

  const variants: ProductVariantOptionDTO[] = data.product.variants.edges.map((e) => {
    const node = e.node;
    const sizeOption = sizeOptionName
      ? node.selectedOptions.find((o) => o.name === sizeOptionName)
      : undefined;
    const colorOption = colorOptionName
      ? node.selectedOptions.find((o) => o.name === colorOptionName)
      : undefined;

    const inventoryQuantity = node.inventoryQuantity ?? 0;

    return {
      variantId: node.id,
      title: node.title,
      sku: node.sku,
      barcode: node.barcode,
      size: sizeOption ? parseSizeValue(sizeOption.value) : null,
      color: colorOption?.value ?? null,
      available: node.availableForSale && inventoryQuantity > 0,
      inventoryQuantity,
    };
  });

  return {
    productId: data.product.id,
    hasSizeOption: Boolean(sizeOptionName),
    hasColorOption: Boolean(colorOptionName),
    variants,
  };
}

const PRODUCT_COST_QUERY = /* GraphQL */ `
  query ProductCost($id: ID!) {
    product(id: $id) {
      variants(first: 100) {
        edges {
          node {
            inventoryItem {
              unitCost {
                amount
              }
            }
          }
        }
      }
    }
  }
`;

interface ProductCostQueryResult {
  product: {
    variants: { edges: { node: { inventoryItem: { unitCost: { amount: string } | null } | null } }[] };
  } | null;
}

/** Average "cost per item" across a product's variants (null when no variant has a cost). */
export async function getProductAverageCost(productId: string): Promise<number | null> {
  const data = await shopifyGraphQL<ProductCostQueryResult>(PRODUCT_COST_QUERY, { id: productId });
  const costs = (data.product?.variants.edges ?? [])
    .map((e) => parseFloat(e.node.inventoryItem?.unitCost?.amount ?? ""))
    .filter((c) => Number.isFinite(c) && c > 0);
  if (costs.length === 0) return null;
  return Math.round((costs.reduce((s, c) => s + c, 0) / costs.length) * 100) / 100;
}

const PRODUCTS_LIST_QUERY = /* GraphQL */ `
  query ExchangeProducts($first: Int!) {
    products(first: $first, query: "status:active", sortKey: TITLE) {
      edges {
        node {
          id
          title
          totalInventory
        }
      }
    }
  }
`;

interface ProductsListQueryResult {
  products: {
    edges: { node: { id: string; title: string; totalInventory: number | null } }[];
  };
}

/**
 * Returns active products that can be offered as an alternative exchange article. Only products
 * with stock are included, so the customer can't pick something entirely sold out. Kept lightweight
 * (id + title); the actual variant/size availability is fetched on demand once a product is picked.
 */
export async function listExchangeProducts(first = 100): Promise<ProductListItemDTO[]> {
  const data = await shopifyGraphQL<ProductsListQueryResult>(PRODUCTS_LIST_QUERY, { first });
  return data.products.edges
    .filter((e) => (e.node.totalInventory ?? 0) > 0)
    .map((e) => ({ productId: e.node.id, title: e.node.title }));
}
