---
tags: [com-interop-expert/core-principles]
summary: "Shell COM objects require STA thread initialization; MTA threads (console apps, background tasks) cause marshaling failures or silent deadlocks"
---

# STA Thread Requirement

**What it means**: Shell COM objects (ImmersiveShell, VirtualDesktopManager) require Single-Threaded Apartment (STA) initialization. MTA threads will fail or deadlock.

**Why it matters**: Console apps default to MTA. Background threads are MTA. COM calls from wrong apartment cause marshaling failures or silent deadlocks.

**How to implement**:
- Mark entry point with `[STAThread]` attribute
- For background operations, create a dedicated STA thread
- Never call shell COM from ThreadPool threads
- Use `Thread.SetApartmentState(ApartmentState.STA)` before starting dedicated threads
