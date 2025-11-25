| Scenario                        | Endpoint            | What happens                                  |
| ------------------------------- | ------------------- | --------------------------------------------- |
| New user (first time after OTP) | POST /auth/register | Creates user in MongoDB, returns custom token |
| Existing user                   | POST /auth/login    | Finds user, returns custom token              |

App flow:

1. User does phone OTP with Firebase → gets basic token
2. App calls /auth/login first
3. If 404 "User not registered" → redirect to registration screen → call /auth/register with name/email
4. Use returned customToken to signInWithCustomToken() in Firebase
