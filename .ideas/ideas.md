1. A click on a word in the word list opens the word's page. The page shows the word, its definition, and a list of example sentences. The page also has a "back" button that returns to the word list.
2. Each item in the menu should have a shortcut key. For example, "Add word" could be Alt+A, "Words" could be Alt+W, and "Settings" could be Alt+S. The shortcuts should be displayed next to the menu items.
3. Focus in the input field when opening the "Add word" page, so the user can start typing immediately.
4. The sidebar should reach the bottom of the page, even if the content is short. 
5. The sidebar should be collapsible, with a button to toggle its visibility. When collapsed, the sidebar should show only icons for each menu item.
6. The Review page's shortcuts should be at the bottom of the page.
7. Remove the default focus outline from buttons and inputs. Add a custom focus style that is consistent across the app, such as a 2px solid border in the primary color.



9. If any user has saved a word from the AI suggestions, it should be saved in DB and not use AI to suggest the same word again. The AI suggestions should only show words that have not been saved by any user yet. It will save tokens.
10. The practice page should be more informative, otherwise it's not clear what to do there, especially when there is nothing due yet.
11. We need to differentiate the word's (sense's) data's translation. For instance, for a word Arbeit we have a translation to English "work" and a translation to french "travail". It means, we need a mechanism to save word's data in different languages, depending on the user's language pair. For example, if a user is learning German and speaks English, the translation should be saved in English. If another user is learning German and speaks French, the translation should be saved in French. The AI suggestions should also take into account the user's language pair when suggesting translations. Also, if an English user triggers the AI to suggest a translation for a German word, and then a french user triggers the AI to suggest a translation for the same German word, the AI should not suggest the same translation that was already suggested for the English user. The AI should only suggest translations that have not been suggested for any user yet.
12. If there is only one sense in a suggestion, it should be selected and the form should be open right away.


- Settings export that includes the practice tables.
- Tidying stale lines in SPEC.md.



10. In Admin area if there are no reports, don't show "Could not load the reports" or "Could not load the rejected senses"
11. The reports should have a link to a user page (or at least their email for now)
12. Reduce the min length of report to 10 characters. It is too §long and users are not reporting because of that.


12. Add a list of all suggestions in the admin area to conveniently work with them.
11. Why is Setup form appears every time when I sign in?


1. On the Word page add a button to add an extra example sentence for the word. The user can type a sentence and submit it, and it will be saved in the database associated with that word. Also, a sentence can be added by AI. Also, a user can see sentences added by other users + there should be a way to report inappropriate sentences. The AI should not suggest sentences that have been reported as inappropriate. Also, a user can vote on the sentences added by other users, and the sentences with the most votes should be shown at the top of the list. The AI should also suggest sentences that have been highly voted by users.



- Do you want the SPEC.md edits applied now or after the work? = apply now
- The design includes no per-user drill-down or admin actions on users. Do you want either, or does
  that stay for later? = stay for later 
