<?php
/**
 * Bridge endpoint for boutique product data.
 *
 * Called by boutique frontend JS (const API_URL = '/wp-json-shop.php').
 * Bootstraps WordPress, fetches products via JCC REST API,
 * returns them in the format the JS expects.
 *
 * Response shape:
 *   [{
 *     id, name, description, price, regular_price, stock, in_stock,
 *     category, featured, images: ["url", ...],
 *     variations: [{ id, price, stock, in_stock, attributes: [{ name, option }] }],
 *     attrs_meta: [{ label, options: [...] }]
 *   }]
 */

// Bootstrap WordPress (assumes same web root)
require_once __DIR__ . '/wp-load.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

try {
    // Use WooCommerce REST API internally via WP_Query
    $products = wc_get_products([
        'limit'  => -1,
        'status' => 'publish',
    ]);

    $result = [];

    foreach ($products as $product) {
        $id   = $product->get_id();
        $name = $product->get_name();

        // Images
        $image_ids = $product->get_gallery_image_ids();
        $images    = [];
        $featured_id = $product->get_image_id();
        if ($featured_id) {
            $images[] = wp_get_attachment_url($featured_id);
        }
        foreach ($image_ids as $img_id) {
            $url = wp_get_attachment_url($img_id);
            if ($url) {
                $images[] = $url;
            }
        }

        $entry = [
            'id'            => $id,
            'name'          => $name,
            'description'   => $product->get_short_description() ?: $product->get_description(),
            'price'         => (float) ($product->get_price() ?: 0),
            'regular_price' => $product->get_regular_price() ? (float) $product->get_regular_price() : null,
            'stock'         => $product->get_stock_quantity(),
            'in_stock'      => $product->is_in_stock(),
            'category'      => '',
            'featured'      => $product->is_featured(),
            'images'        => $images,
            'variations'    => [],
            'attrs_meta'    => [],
        ];

        // Category
        $categories = $product->get_category_ids();
        if (!empty($categories)) {
            $term = get_term(reset($categories));
            $entry['category'] = $term ? $term->name : '';
        }

        // Variable product → build variations + attrs_meta
        if ($product->is_type('variable')) {
            /** @var WC_Product_Variable $product */
            $variation_ids = $product->get_children();
            $attrs         = $product->get_attributes();

            // attrs_meta
            $entry['attrs_meta'] = [];
            foreach ($attrs as $tax => $attr) {
                /** @var WC_Product_Attribute $attr */
                $entry['attrs_meta'][] = [
                    'label'   => $attr->get_name(),
                    'options' => $attr->get_options(),
                ];
            }

            // variations
            $variations = [];
            $default_attrs = $product->get_default_attributes();
            foreach ($variation_ids as $vid) {
                $variation = wc_get_product($vid);
                if (!$variation) continue;

                $attrs_arr = [];
                $var_attrs = $variation->get_attributes();
                foreach ($var_attrs as $tax_name => $option_val) {
                    $label = wc_attribute_label($tax_name, $product);
                    $attrs_arr[] = [
                        'name'   => $option_val ?: '',
                        'option' => $option_val ?: '',
                    ];
                }

                $variations[] = [
                    'id'       => $vid,
                    'price'    => (float) ($variation->get_price() ?: 0),
                    'stock'    => $variation->get_stock_quantity(),
                    'in_stock' => $variation->is_in_stock(),
                    'attributes' => $attrs_arr,
                ];
            }
            $entry['variations'] = $variations;
        }

        $result[] = $entry;
    }

    echo json_encode($result, JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'error'   => true,
        'message' => $e->getMessage(),
    ]);
}
