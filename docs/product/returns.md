---
title: "Returns, credits & payments"
section: "Selling"
summary: "Reverse a sale with a return that restocks, record store credit, and see every payment."
keywords: ["return","returns","credit","credits","store credit","refund","payment","payments","restock","reverse","rma","post-sale"]
order: 21
---
# Returns, credits & payments

Not every sale is final. The **Sales** page carries the whole post-sale flow through its sub-nav: **Orders & invoices**, **Returns**, **Credits**, and **Payments**.

## Returns
A **return** brings product back from a customer. Open **Sales, Returns**, click **New return**, pick the customer (or the originating order), and add the line items and quantities coming back. Receiving a return **restocks inventory** - each returned line posts a positive movement to the on-hand ledger (a `return` movement, fully auditable), the mirror of the `sale` that took it out. It's the same ledger that backs [inventory](/docs/inventory), so on-hand stays trustworthy.

## Credits
A **credit** is store credit owed to a customer - from a return, a goodwill adjustment, or an overpayment. Record one under **Sales, Credits** with an amount and a reason. An open credit can be **applied to an invoice**, reducing its balance due alongside payments (an invoice's balance is total minus payments minus credits applied).

## Payments
**Sales, Payments** lists every payment recorded against your invoices - amount, method, date, and the invoice it settled. Recording a payment happens from an invoice (see [Sales orders and invoicing](/docs/sales)); this view is the read-across of all of them, so you can see what's come in without opening each invoice one by one.

> The Copilot handles the post-sale flow too: *"Return 3 Blue Dream 3.5g from Green Leaf's last order"* restocks them, and *"apply a $40 credit to INV-0006"* draws down the balance - each behind a single approval.
