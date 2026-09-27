package com.abcsystems.flowbiz;

import android.os.Bundle;

import com.abcsystems.flowbiz.billing.FlowBizBillingPlugin;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // In-app plugins must be registered before the bridge starts.
        registerPlugin(FlowBizBillingPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
