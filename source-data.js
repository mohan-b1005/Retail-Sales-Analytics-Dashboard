window.SOURCE_DATA = {
  Sales: (window.SALES_PARTS || []).flat(),
  Products: window.PRODUCT_DATA || [],
  Customers: window.CUSTOMER_DATA || [],
  Date: window.DATE_DATA || [],
  CurrencyRates: window.RATE_DATA || []
};
