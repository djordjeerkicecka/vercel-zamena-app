import { shopifyGraphQL } from "./client";
import { normalizePhone } from "../phone";
import { SIZE_OPTION_PATTERN, parseSizeValue } from "./sizeUtils";
import type { OrderLineItemDTO, OrderLookupResultDTO } from "../types";

const ORDER_LOOKUP_QUERY = /* GraphQL */ `
  query FindOrder($query: String!) {
    orders(first: 1, query: $query) {
      edges {
        node {
          id
          name
          phone
          email
          shippingAddress {
            firstName
            lastName
            phone
            address1
            address2
            city
            zip
            country
          }
          lineItems(first: 50) {
            edges {
              node {
                id
                title
                quantity
                sku
                originalUnitPriceSet {
                  shopMoney {
                    amount
                  }
                }
                variant {
                  id
                  title
                  selectedOptions {
                    name
                    value
                  }
                  image {
                    url
                  }
                  product {
                    id
                    featuredImage {
                      url
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

interface OrderLookupQueryResult {
  orders: {
    edges: {
      node: {
        id: string;
        name: string;
        phone: string | null;
        email: string | null;
        shippingAddress: {
          firstName: string | null;
          lastName: string | null;
          phone: string | null;
          address1: string | null;
          address2: string | null;
          city: string | null;
          zip: string | null;
          country: string | null;
        } | null;
        lineItems: {
          edges: {
            node: {
              id: string;
              title: string;
              quantity: number;
              sku: string | null;
              originalUnitPriceSet: { shopMoney: { amount: string } };
              variant: {
                id: string;
                title: string | null;
                selectedOptions: { name: string; value: string }[];
                image: { url: string } | null;
                product: { id: string; featuredImage: { url: string } | null };
              } | null;
            };
          }[];
        };
      };
    }[];
  };
}

function normalizeOrderNumberForSearch(raw: string): string {
  const trimmed = raw.trim();
  const digitsOnly = trimmed.replace(/^#/, "");
  return `#${digitsOnly}`;
}

function phoneMatchesOrder(
  order: OrderLookupQueryResult["orders"]["edges"][number]["node"],
  targetPhone: string
): boolean {
  // Phone verification uses only order-level fields (order.phone + shipping address). We avoid the
  // `customer` object on purpose — it requires the read_customers / protected-customer-data scope.
  const candidatePhones = [order.phone, order.shippingAddress?.phone].filter(
    (p): p is string => Boolean(p)
  );
  return candidatePhones.some((p) => normalizePhone(p) === targetPhone);
}

/**
 * Looks up an order by order number and verifies the provided phone number matches
 * the phone on file (order-level phone or shipping address). Returns null if no order
 * is found OR if the phone doesn't match — callers must not distinguish between these
 * two cases in the response, to avoid leaking whether an order exists.
 */
export async function findOrderByNumberAndPhone(
  orderNumberRaw: string,
  phoneRaw: string
): Promise<OrderLookupResultDTO | null> {
  const targetPhone = normalizePhone(phoneRaw);
  if (!targetPhone) return null;

  const searchTerm = normalizeOrderNumberForSearch(orderNumberRaw);
  const data = await shopifyGraphQL<OrderLookupQueryResult>(ORDER_LOOKUP_QUERY, {
    query: `name:${searchTerm}`,
  });

  const order = data.orders.edges[0]?.node ?? null;

  if (!order) return null;
  if (!phoneMatchesOrder(order, targetPhone)) return null;

  const customerName =
    [order.shippingAddress?.firstName, order.shippingAddress?.lastName].filter(Boolean).join(" ") ||
    "";

  const lineItems: OrderLineItemDTO[] = order.lineItems.edges
    .filter((e) => e.node.variant !== null)
    .map((e) => {
      const sizeOption = e.node.variant!.selectedOptions.find((o) => SIZE_OPTION_PATTERN.test(o.name));
      return {
        lineItemId: e.node.id,
        productId: e.node.variant!.product.id,
        variantId: e.node.variant!.id,
        title: e.node.title,
        variantTitle: e.node.variant!.title,
        sku: e.node.sku,
        quantity: e.node.quantity,
        price: e.node.originalUnitPriceSet.shopMoney.amount,
        imageUrl: e.node.variant!.image?.url ?? e.node.variant!.product.featuredImage?.url ?? null,
        originalSize: sizeOption ? parseSizeValue(sizeOption.value) : null,
      };
    });

  return {
    orderId: order.id,
    orderNumber: order.name.replace(/^#/, ""),
    customerName,
    email: order.email ?? "",
    phone: order.phone ?? order.shippingAddress?.phone ?? phoneRaw,
    shippingAddress: order.shippingAddress
      ? {
          address1: order.shippingAddress.address1 ?? "",
          address2: order.shippingAddress.address2,
          city: order.shippingAddress.city ?? "",
          zip: order.shippingAddress.zip ?? "",
          country: order.shippingAddress.country ?? "Srbija",
        }
      : null,
    lineItems,
  };
}
