---
title: "Sales orders and invoicing"
section: "Selling"
summary: "Sell to customers, decrement inventory, see real gross margin, invoice orders, and record payments."
keywords: ["sales","order","orders","sales order","invoice","invoicing","payment","customer","fulfill","confirm","cancel","revenue","margin","gross margin","cogs","billing","return","credit"]
order: 4
---
# Sales orders and invoicing

The **Sales** page is where the catalog turns into revenue. An **order** is a set of line items sold to a customer; an **invoice** is a billable snapshot of an order; and **payments** settle invoices. The sub-nav carries **Orders**, **Invoices**, **Returns**, **Credits**, and **Payments**.

## Orders
Click **New order**, pick a customer (created with the CUSTOMER role if new), and add line items - each is a product matched by SKU, a quantity, and a unit price that defaults to the product's price.

An order moves through Distru's fulfillment lifecycle:
- **Pending** - saved but holds no stock. Use it to stage an order you're not ready to fulfill (imported orders also land here as drafts). It's tracked as *reserved* but nothing has left inventory.
- **Processing** → **Ready to ship** → **Delivering** → **Delivered** → **Completed** - the active fulfillment stages. On-hand is **decremented** for every line the moment an order leaves Pending (posted to the inventory ledger as a `sale` movement, fully auditable), and stays committed through completion. New orders you create by hand start in Processing.
- **Canceled** - the order is voided and any stock it took is **restored**.

Leaving Pending is the only step that moves inventory, and it does so exactly once - advancing through the later stages never double-posts, and canceling reverses it.

## Real gross margin
Because stock is FIFO-costed, issuing a line records its **actual COGS**. Once an order has left Pending, its detail page shows a **Gross margin** card - revenue minus COGS, with margin % - computed from what the goods really cost, not a guess. (A Pending order carries no COGS yet, so no margin card appears until stock is committed.)

## Invoices and payments
From an active (non-pending) order, create an **invoice**: it snapshots the order's full financial breakdown (subtotal, charges, discounts, taxes, total) at issue time. Its **payment status** rolls **Not paid** → **Partially paid** → **Fully paid** (and **Over paid** if you record more than the balance) as you record payments; an invoice can also be **voided** independently. The balance due is total minus payments and any credits applied. You can also generate an order or invoice **PDF**.

To reverse a sale, record a **return** (which restocks inventory), issue a **credit**, or see every payment in one list - all under the Sales sub-nav; see [Returns, credits & payments](/docs/returns).

## The Copilot does all of this
Everything on this page is also an agent action, each behind a single approval:

> *"Sell 10 Blue Dream 3.5g and 5 OG Kush 3.5g to Green Leaf Dispensary."*
> *"Invoice order SO-0007, net 30."*
> *"Record a $250 check payment on INV-0003."*
> *"Cancel order SO-0005."*

You can also **import** historical orders from a spreadsheet - each row is a line item grouped by order number; imported orders land as **drafts** for you to review before they touch inventory (see [Importing data](/docs/importing)).
