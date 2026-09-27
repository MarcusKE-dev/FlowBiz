package com.abcsystems.flowbiz.billing;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.ConsumeParams;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONException;

import java.util.ArrayList;
import java.util.List;

/**
 * FlowBiz's bridge to Google Play Billing.
 *
 * DELIBERATELY THIN. This class gets a purchase token from Google and hands
 * it to JavaScript, which sends it to the FlowBiz Worker
 * (/api/billing/google-play/verify). The Worker asks Google Play whether the
 * token is real and decides what it grants. Nothing here unlocks a feature,
 * and nothing here holds a secret.
 *
 * Products are one-time products (see src/billing/catalog.js): the licence
 * is non-consumable, the Pro and annual-services passes are consumables
 * that JavaScript consumes only after the Worker has confirmed them.
 */
@CapacitorPlugin(name = "FlowBizBilling")
public class FlowBizBillingPlugin extends Plugin implements PurchasesUpdatedListener {

    private BillingClient billingClient;
    private PluginCall pendingPurchaseCall;

    @Override
    public void load() {
        billingClient = BillingClient.newBuilder(getContext())
                .setListener(this)
                .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
                .enableAutoServiceReconnection()
                .build();
    }

    @Override
    protected void handleOnDestroy() {
        if (billingClient != null) billingClient.endConnection();
    }

    private interface Ready { void run(); }

    private void whenConnected(PluginCall call, Ready ready) {
        if (billingClient.isReady()) {
            ready.run();
            return;
        }
        billingClient.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(@NonNull BillingResult result) {
                if (result.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                    ready.run();
                } else {
                    reject(call, result);
                }
            }

            @Override
            public void onBillingServiceDisconnected() {
                // enableAutoServiceReconnection() reconnects on the next call.
            }
        });
    }

    private static String codeFor(int responseCode) {
        switch (responseCode) {
            case BillingClient.BillingResponseCode.USER_CANCELED: return "USER_CANCELED";
            case BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED: return "ITEM_ALREADY_OWNED";
            case BillingClient.BillingResponseCode.ITEM_UNAVAILABLE: return "ITEM_UNAVAILABLE";
            case BillingClient.BillingResponseCode.BILLING_UNAVAILABLE: return "BILLING_UNAVAILABLE";
            case BillingClient.BillingResponseCode.SERVICE_UNAVAILABLE:
            case BillingClient.BillingResponseCode.SERVICE_DISCONNECTED:
            case BillingClient.BillingResponseCode.NETWORK_ERROR: return "NETWORK";
            case BillingClient.BillingResponseCode.DEVELOPER_ERROR: return "DEVELOPER_ERROR";
            default: return "ERROR";
        }
    }

    private static void reject(PluginCall call, BillingResult result) {
        if (call == null) return;
        call.reject(result.getDebugMessage(), codeFor(result.getResponseCode()));
    }

    private static JSObject purchaseToJs(Purchase purchase) {
        JSObject out = new JSObject();
        JSArray products = new JSArray();
        for (String id : purchase.getProducts()) products.put(id);
        out.put("productIds", products);
        out.put("purchaseToken", purchase.getPurchaseToken());
        out.put("orderId", purchase.getOrderId());
        out.put("purchaseState", purchase.getPurchaseState() == Purchase.PurchaseState.PURCHASED
                ? "purchased"
                : purchase.getPurchaseState() == Purchase.PurchaseState.PENDING ? "pending" : "unspecified");
        out.put("acknowledged", purchase.isAcknowledged());
        if (purchase.getAccountIdentifiers() != null) {
            out.put("accountTag", purchase.getAccountIdentifiers().getObfuscatedAccountId());
        }
        return out;
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        whenConnected(call, () -> {
            JSObject out = new JSObject();
            out.put("available", true);
            call.resolve(out);
        });
    }

    private void queryProductDetails(List<String> productIds, PluginCall call, ProductDetailsCallback callback) {
        List<QueryProductDetailsParams.Product> products = new ArrayList<>();
        for (String id : productIds) {
            products.add(QueryProductDetailsParams.Product.newBuilder()
                    .setProductId(id)
                    .setProductType(BillingClient.ProductType.INAPP)
                    .build());
        }
        QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder().setProductList(products).build();
        billingClient.queryProductDetailsAsync(params, (result, detailsResult) -> {
            if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                reject(call, result);
                return;
            }
            callback.onDetails(detailsResult.getProductDetailsList());
        });
    }

    private interface ProductDetailsCallback { void onDetails(List<ProductDetails> details); }

    /** The store's own title and localised price, for display only. */
    @PluginMethod
    public void getProducts(PluginCall call) {
        List<String> ids;
        try {
            ids = call.getArray("productIds").toList();
        } catch (JSONException | NullPointerException e) {
            call.reject("productIds is required", "INVALID");
            return;
        }
        final List<String> productIds = ids;
        whenConnected(call, () -> queryProductDetails(productIds, call, (details) -> {
            JSArray out = new JSArray();
            for (ProductDetails d : details) {
                JSObject p = new JSObject();
                p.put("productId", d.getProductId());
                p.put("title", d.getTitle());
                p.put("description", d.getDescription());
                ProductDetails.OneTimePurchaseOfferDetails offer = d.getOneTimePurchaseOfferDetails();
                if (offer != null) {
                    p.put("formattedPrice", offer.getFormattedPrice());
                    p.put("priceAmountMicros", offer.getPriceAmountMicros());
                    p.put("priceCurrencyCode", offer.getPriceCurrencyCode());
                }
                out.put(p);
            }
            JSObject res = new JSObject();
            res.put("products", out);
            call.resolve(res);
        }));
    }

    /**
     * Opens Google Play's purchase sheet. `accountTag` is the hashed
     * business id the Worker checks the purchase against.
     */
    @PluginMethod
    public void purchase(PluginCall call) {
        String productId = call.getString("productId");
        String accountTag = call.getString("accountTag");
        if (productId == null || accountTag == null) {
            call.reject("productId and accountTag are required", "INVALID");
            return;
        }
        if (pendingPurchaseCall != null) {
            call.reject("A purchase is already in progress", "IN_PROGRESS");
            return;
        }
        List<String> ids = new ArrayList<>();
        ids.add(productId);
        whenConnected(call, () -> queryProductDetails(ids, call, (details) -> {
            if (details == null || details.isEmpty()) {
                call.reject("This product is not available in Google Play.", "ITEM_UNAVAILABLE");
                return;
            }
            List<BillingFlowParams.ProductDetailsParams> productParams = new ArrayList<>();
            productParams.add(BillingFlowParams.ProductDetailsParams.newBuilder()
                    .setProductDetails(details.get(0))
                    .build());
            BillingFlowParams flowParams = BillingFlowParams.newBuilder()
                    .setProductDetailsParamsList(productParams)
                    .setObfuscatedAccountId(accountTag)
                    .build();
            pendingPurchaseCall = call;
            call.setKeepAlive(true);
            getActivity().runOnUiThread(() -> {
                BillingResult launch = billingClient.launchBillingFlow(getActivity(), flowParams);
                if (launch.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                    finishPurchase(null, launch);
                }
            });
        }));
    }

    @Override
    public void onPurchasesUpdated(@NonNull BillingResult result, @Nullable List<Purchase> purchases) {
        if (result.getResponseCode() == BillingClient.BillingResponseCode.OK && purchases != null && !purchases.isEmpty()) {
            finishPurchase(purchases.get(0), result);
        } else {
            finishPurchase(null, result);
        }
    }

    private void finishPurchase(@Nullable Purchase purchase, BillingResult result) {
        PluginCall call = pendingPurchaseCall;
        pendingPurchaseCall = null;
        if (call == null) return;
        call.setKeepAlive(false);
        if (purchase != null) {
            call.resolve(purchaseToJs(purchase));
        } else {
            reject(call, result);
        }
    }

    /** Purchases Play still holds for this user: owned licences and unconsumed passes. For restore. */
    @PluginMethod
    public void queryPurchases(PluginCall call) {
        whenConnected(call, () -> billingClient.queryPurchasesAsync(
                QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build(),
                (result, purchases) -> {
                    if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                        reject(call, result);
                        return;
                    }
                    JSArray out = new JSArray();
                    for (Purchase p : purchases) out.put(purchaseToJs(p));
                    JSObject res = new JSObject();
                    res.put("purchases", out);
                    call.resolve(res);
                }));
    }

    /** Consume a pass AFTER the Worker has confirmed it, so it can be bought again. */
    @PluginMethod
    public void consume(PluginCall call) {
        String token = call.getString("purchaseToken");
        if (token == null) {
            call.reject("purchaseToken is required", "INVALID");
            return;
        }
        whenConnected(call, () -> billingClient.consumeAsync(
                ConsumeParams.newBuilder().setPurchaseToken(token).build(),
                (result, consumedToken) -> {
                    if (result.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                        call.resolve();
                    } else {
                        reject(call, result);
                    }
                }));
    }

    /** Acknowledge a non-consumable. The Worker also does this; either is enough. */
    @PluginMethod
    public void acknowledge(PluginCall call) {
        String token = call.getString("purchaseToken");
        if (token == null) {
            call.reject("purchaseToken is required", "INVALID");
            return;
        }
        whenConnected(call, () -> billingClient.acknowledgePurchase(
                AcknowledgePurchaseParams.newBuilder().setPurchaseToken(token).build(),
                (result) -> {
                    if (result.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                        call.resolve();
                    } else {
                        reject(call, result);
                    }
                }));
    }
}
