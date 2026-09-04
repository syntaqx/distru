# AI Product Engineer --- Takehome Exercise

Time: 3--4 hours (but take as little or long as you deem necessary)

## Why we run this exercise

The job is building and owning Distru's agentic harness. Most of that work is in the harness design, which has no single correct answer. We would love to see what you specifically choose to do and why!

## Some context first

### What is Distru?

Distru is a seed-to-sale ERP for licensed cannabis operators --- cultivators, manufacturers, distributors, and retailers. Customers run their inventory, purchasing, sales orders, invoicing, manufacturing, and state compliance reporting (Metrc/BioTrack) through us.

### Our next project: The Distru agentic harness

We want build an agentic harness that solves 2 categories of problems for Distru customers:

1. Automated workflows. Users configure workflows that can run on a trigger (cron-based or user-action based) and connect to all of their operational software (Distru, Quickbooks, Calendar, Analytics etc...). An example workflow could be listening to their emails for a Cannabis lab potency test result and then based on the result, download the result PDF, attach it to the appropriate inventory in Distru, and then mark that inventory ready for sale.

2. A Claude Cowork style chat co-pilot. Users ask questions and perform one off actions. The co-pilot performs the tasks by leveraging the Distru MCP server plus whatever other MCP servers that customer has connected --- commonly QuickBooks, Sage, Metrc,  Google Drive, Calendar, Sheets, etc...

You will not be building either of these use cases (that scope would be ridiculous for this exercise!). However, you should approach this exercise with the understanding that our harness will need to power both these use cases.

## The exercise

Assuming we don't have an agentic harness today. Your job as an AI Product Engineer is to design our agentic harness, incorporating the following as the first use case:

"A customer wants to upload CSVs of their product catalog into Distru"

Some context:

- When adding new products to Distru (during onboarding & in regular day to day), customers sometimes will want to do mass uploads from CSVs/XLSX
- The file they upload is always in their custom format. There's no predicting what columns they will have and how standardized their data will be. Each customer's format will also look different than the next.
- A file could be as little as 100 rows, and as much as >10,000 rows\
    The customer expects that they can just throw their file in Distru's AI to upload and it just "works"

For the sake of this exercise, assume they will be uploading it into a Distru Copilot chat (like Claude Cowork). In the future however, they will also be able to trigger it via workflows such as "Scan X google sheet every night, and for every new row in there, create that product in Distru".

Remember from the section above that this harness will need to expand in the future to support bigger use cases

* * * * *

## References

Here is a list of references that you may find helpful, feel free to use some, all, or none of them. They're only provided you give you as much context as possible, do not feel obligated to act on them in any way.

Internal API: POST /upload-products

There is an upload products feature in Distru internally. It expects an exact CSV template format that Distru defines in order to upload products. It then runs through a service that chunks the CSV, validates the data integrity of each row, and then either uploads the file, or partially uploads valid rows, and returns a CSV file of row-mapped errors for the ones that [failed validation](https://help.distru.com/en/articles/12703323-bulk-upload-errors-products).

Distru MCP\
Distru has an existing MCP, and if need be, assume we are able to add any tools we want to it relatively cheaply: [https://mcp.distru.com/docs

](<https://mcp.distru.com/docs>)

## Deliverables

Your job is to write a tech spec for other engineers to review. Here are some guidelines:

- Use AI how you normally would
- Don't leave things vague. (i.e. instead of saying we'll need a ask-user-questions tool in our harness, explain exactly how you'd implement it, where it gets triggered, who has access to it, etc...)
- Don't leave decisions ambiguous or "up to the product team". You make all the decisions, we want to see your convictions.
- Diagrams, schema examples, pseudo-code, and even interface mockups are all encouraged to be included if you feel like they can convey your sentiments better than words. But don't feel obligated to.

You should deliver 2 assets at the end of this:

1. A tech spec that covers at least:
  a. Your overall agentic harness design + reasoning behind it
  b. Your approach to solving the product import problem, and how it fits into the harness
  c.  Call out edge cases and product decisions you made, and why
  d.  What you consider the MVP, and what is deferred
2. A 5-10 minute Loom video going over:
  a. How you used AI to aid you in this process
  b. Talk through key decisions you made (i.e. architecture, tooling, product decisions, etc...) and explain your reasoning, alternatives & pros/cons
  c. Talk through what you think is important, but didn't get to cover due to scope/time constraints

## What we're looking for

When we review submissions, we're looking for signs of the following in no particular order:

- Product sense
- Edge case thinking
- MVP pragmatism
- Agentic harness design
- Fundamental engineering knowledge
- Clarity in communicating your thoughts/convictions
