---
"@caucejs/application": minor
---

`Handler.of(GetTalk)` builds a handler that names its request, so it is added alone: `app.handle(GetTalkHandler)`. The pair `handle(GetTalk, GetTalkHandler)` still works.
