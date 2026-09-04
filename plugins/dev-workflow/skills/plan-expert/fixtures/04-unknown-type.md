## Step: Implement user onboarding flow diagrams

Create visual diagrams for the user onboarding flow showing the progression from signup through activation and first-use.

## Artifact: flowchart

```
[Signup] --> [EmailSent] --> [Verified] --> [ProfileSetup] --> [Active]
                                |
                                +--> [Expired] --> [Resend] --> [Verified]
```

The flowchart shows the happy path and the email expiry edge case. Each node represents a user-visible screen or automated step; arrows are triggered by user action or timer.
