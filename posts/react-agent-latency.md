# How to Keep a ReAct Agent's Response Time Under 5 Seconds

2025 was the year of agents: a loop that alternates between an LLM and tool calls until it produces a final output.

```
input → LLM → tool → LLM → tool → ... → output
```

It's a deceptively simple pattern that unlocks real capability, but it's also annoyingly slow — I've watched Claude Code write something slower than I could have written it by hand. That's a tough tradeoff for voice interaction, but at Zocdoc we didn't have the luxury of avoiding it: scheduling procedures get too complex for a simple state-machine approach to handle. Here's how to keep latency in check. Most of this applies to text-based agents too.

---

## 1. Never force sequential tool calls

Patterns like `search_locations("Massachusetts")` → `get_location("Watertown Office")`, or `get_zip_code_from_name("Roxbury")` → `get_nearby_locations("02119")`, are an anti-pattern. If the agent needs both pieces of information to act, combine the tools. In practice, models hold up well to complex function signatures — we've pushed up to 20 input arguments without issues.

More importantly: don't make the agent fetch context it doesn't need to fetch. Before reaching for a `get_locations()` tool, ask how many locations there actually are. If the answer is ten, just put them in context directly instead of paying for a round trip.

## 2. Underspecified tasks cost you twice

Complex, poorly-defined tasks slow agents down on two levels. The obvious one is more output and thinking tokens. The less obvious one: I've observed that even non-reasoning models slow down as task complexity increases, independent of output length. Temperature = 0 seems to exacerbate it.

![Latency variance across task complexity trials](images/latency.png)

Here's a speculative explanation, offered for fun rather than as established fact (Take this with a grain of salt roughly the size of a GPU). With modern Mixture-of-Experts (MoE) models, every token is routed to different expert networks. The number of activated experts per token is typically fixed, but the expert pattern varies token to token, and layer to layer while decoding — and that pattern affects serving efficiency since experts are sharded across GPUs: GPU link overhead, expert load imbalance, and ultimately latency. Research on MoE serving, including *MoETuner*¹ and *HarMoEny*², backs up the general claim that routing and load balance materially affect inference performance.

Two practical takeaways:

1. Build an agent skill (or even a simple linting step) that scans the prompt and any other inference input for contradictions or ambiguity before it ever reaches the model.
2. Where available, inspect internal thought signatures to see what the model is actually finding unclear.

One caveat on the latter: with Gemini, exposed "thought traces" are LLM-generated *summaries* of the reasoning, not raw thought tokens, so generating them adds latency of its own.

## 3. Standard observability gets you halfway

If you're reading this, you already cache aggressively, minimize network cost, and you know that you can't optimize what you don't measure. You're probably also already tracking per-tool latency and LLM call latency. That's necessary, but it's not sufficient. A few things worth adding:

- **Input/output token length vs. latency.** The correlation is inconsistent across models and providers — sometimes flat, sometimes not worth the analysis time. Check it once, don't assume it generalizes.
- **LLM latency specifically on tool calls** — the time to reason about and populate a tool call. A spike here is often a sign that a particular tool's interface is confusing the model, not that the model itself is slow.
- **LLM latency distribution by time of day**, with Slack alerts (or similar) for anomalies. This is your best signal for provider reliability. These models are enormous and hard to serve at scale — most providers have performance dips. Knowing the shape and frequency of those dips lets you decide how much engineering effort it's actually worth spending around them.

---

¹ MoETuner: [arxiv.org/abs/2502.06643](https://arxiv.org/abs/2502.06643)
² HarMoEny: [arxiv.org/abs/2506.12417](https://arxiv.org/abs/2506.12417)
