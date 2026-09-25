# Requirements Document

## Introduction

The Expense and Budget Visualizer is a client-side web application that allows users to track their personal spending by adding transactions, viewing a running list of expenses, monitoring their total balance, and visualizing spending distribution across categories via a pie chart. The application requires no backend server, stores all data in the browser's Local Storage, and is built with plain HTML, CSS, and Vanilla JavaScript. It is intended to be used as a standalone web page or browser extension.

## Glossary

- **App**: The Expense and Budget Visualizer web application as a whole.
- **Transaction**: A single expense entry consisting of an item name, a monetary amount, and a category.
- **Transaction_Form**: The HTML form used to create a new Transaction.
- **Transaction_List**: The scrollable UI component that displays all saved Transactions.
- **Balance_Display**: The UI element at the top of the App that shows the computed total balance.
- **Chart**: The pie chart component that visualizes spending distribution by category.
- **Storage**: The browser's Local Storage API used to persist Transaction data client-side.
- **Category**: One of three predefined spending labels — Food, Transport, or Fun — assigned to each Transaction.
- **Validator**: The client-side input validation logic applied to the Transaction_Form before submission.

---

## Requirements

### Requirement 1: Transaction Input Form

**User Story:** As a user, I want to fill out a form with an item name, amount, and category so that I can record a new expense quickly.

#### Acceptance Criteria

1. THE Transaction_Form SHALL contain a text input field for the item name accepting between 1 and 100 characters, a numeric input field for the amount accepting values between 0.01 and 999,999,999.99, and a dropdown selector with exactly the options Food, Transport, and Fun.
2. WHEN the user submits the Transaction_Form with all fields filled with valid values, THE App SHALL add a new Transaction to the Transaction_List and persist it to Storage within 2 seconds.
3. WHEN the user submits the Transaction_Form with one or more empty fields, THE Validator SHALL prevent submission and display an inline error message adjacent to each empty field identifying which field is missing.
4. WHEN the user submits the Transaction_Form with a value in the amount field that is non-numeric, zero, or negative, THE Validator SHALL prevent submission and display an inline error message adjacent to the amount field indicating that the amount must be a number greater than zero.
5. WHEN the user submits the Transaction_Form with an item name exceeding 100 characters, THE Validator SHALL prevent submission and display an inline error message adjacent to the item name field indicating the maximum character limit.
6. WHEN a Transaction is successfully added, THE Transaction_Form SHALL reset the item name field to empty, the amount field to empty, and the dropdown selector to its default unselected state within 1 second of the successful persistence to Storage.
7. IF Storage is unavailable when the user submits the Transaction_Form, THEN THE App SHALL prevent the Transaction from being added to the Transaction_List and display an error message indicating that the transaction could not be saved.

---

### Requirement 2: Transaction List Display

**User Story:** As a user, I want to see a scrollable list of all my recorded transactions so that I can review my spending history at a glance.

#### Acceptance Criteria

1. THE Transaction_List SHALL display every stored Transaction, each showing the item name (up to 100 characters), monetary amount formatted to two decimal places with a currency symbol, and category label.
2. WHILE the number of Transactions exceeds the visible viewport of the Transaction_List container, THE Transaction_List SHALL remain scrollable so that all entries are accessible.
3. WHEN the App loads in the browser, THE Transaction_List SHALL render all Transactions previously persisted in Storage, displaying them in reverse chronological order (most recent first).
4. WHEN the user clicks the delete button on a Transaction, THE App SHALL remove that Transaction from the Transaction_List and from Storage.
5. IF Storage contains no Transactions when the App loads, THEN THE Transaction_List SHALL display an empty-state message indicating no transactions have been recorded.
6. IF Storage is unavailable when the App loads, THEN THE App SHALL display an error message indicating that transaction history could not be loaded and render the Transaction_List as empty.

---

### Requirement 3: Total Balance Display

**User Story:** As a user, I want to see my total balance update automatically so that I always know how much I have tracked in expenses.

#### Acceptance Criteria

1. THE Balance_Display SHALL show the sum of all Transaction amounts as a numeric value formatted with exactly two decimal places and a currency symbol prefix (e.g., "$0.00"), positioned at the top of the App above the Transaction list.
2. WHEN a new Transaction is added, THE Balance_Display SHALL update to reflect the new total within 500 milliseconds without requiring a page reload.
3. WHEN a Transaction is deleted, THE Balance_Display SHALL update to reflect the revised total within 500 milliseconds without requiring a page reload.
4. WHEN no Transactions exist, THE Balance_Display SHALL show a value of 0.00 using the same currency format as criterion 1.
5. IF the sum of all Transaction amounts results in a negative value, THEN THE Balance_Display SHALL display the negative total with a minus sign prefix (e.g., "-$12.50") using the same two-decimal-place format.

---

### Requirement 4: Spending Distribution Chart

**User Story:** As a user, I want to see a pie chart of my spending by category so that I can understand where my money is going.

#### Acceptance Criteria

1. THE Chart SHALL render as a pie chart with one segment per Category that contains at least one Transaction with a positive amount greater than 0, where each segment's size is proportional to the total amount spent in that Category relative to the sum of all category totals, and each segment SHALL have a visually distinct color and a label showing the category name.
2. WHEN a new Transaction is added, THE Chart SHALL update automatically to reflect the new category distribution within 1 second without requiring a page reload.
3. WHEN a Transaction is deleted, THE Chart SHALL update automatically to reflect the revised category distribution within 1 second without requiring a page reload.
4. WHEN no Transactions exist, THE Chart SHALL display a placeholder message indicating no spending data is available instead of rendering a chart with zero-value segments.
5. WHEN the user hovers over a chart segment, THE Chart SHALL display a tooltip showing the Category name, total amount formatted to two decimal places, and percentage of total spending formatted to one decimal place.
6. THE Chart SHALL be implemented using Chart.js loaded via a CDN script tag, requiring no local build tooling or npm installation.

---

### Requirement 5: Data Persistence

**User Story:** As a user, I want my transactions to be saved automatically so that my data is still there when I reopen the app.

#### Acceptance Criteria

1. WHEN a Transaction is created, THE Storage SHALL serialize the full Transaction_List to Local Storage within 200 milliseconds.
2. WHEN a Transaction is deleted, THE Storage SHALL serialize the updated Transaction_List to Local Storage within 200 milliseconds.
3. WHEN the App initializes, THE Storage SHALL deserialize the Transaction_List from Local Storage within 300 milliseconds and make it available to the Transaction_List and Chart before the first render.
4. IF Local Storage is unavailable or returns corrupted data, THEN THE App SHALL initialize with an empty Transaction_List and display a non-blocking warning describing what failed without blocking user interaction.
5. IF a write to Local Storage fails after a Transaction is created or deleted, THEN THE App SHALL display an error message indicating the save failed and revert the Transaction_List to its state before the failed operation.

---

### Requirement 6: File Structure and Code Organization

**User Story:** As a developer, I want the project to follow a defined folder structure so that the codebase remains clean and easy to navigate.

#### Acceptance Criteria

1. THE App SHALL contain exactly one CSS file located at `css/style.css`.
2. THE App SHALL contain exactly one JavaScript file located at `js/app.js`.
3. THE App SHALL be served from a single `index.html` file that links to `css/style.css` and `js/app.js` using `<link>` and `<script>` elements respectively.
4. THE App SHALL not use any JavaScript framework (React, Vue, Angular, etc.) or require a backend server or build tool to run.
5. WHEN a user opens `index.html` directly in a web browser without a local server, THE App SHALL load and render all content correctly with no console errors related to missing resources.
6. THE App SHALL contain no files outside of `index.html`, `css/style.css`, and `js/app.js` except for asset files (images, fonts) placed under an `assets/` directory.

---

### Requirement 7: Browser Compatibility and Performance

**User Story:** As a user, I want the app to work across all major modern browsers without any setup so that I can use it anywhere.

#### Acceptance Criteria

1. THE App SHALL render and function correctly in the current stable releases of Chrome, Firefox, Edge, and Safari without requiring plugins or polyfills.
2. WHEN the App loads for the first time with no stored data, THE App SHALL be interactive within 3 seconds on a standard broadband connection of 25 Mbps or faster, measured from navigation start to the point where the Transaction_Form accepts user input.
3. WHEN a Transaction is added or deleted, THE App SHALL update the Transaction_List, Balance_Display, and Chart within 200 milliseconds, measured from the moment the user confirms the action to the moment all three components reflect the change.
4. WHERE the device viewport width is 768 pixels or wider, THE App SHALL display the Transaction_Form and Chart side by side in a two-column layout where each column occupies no less than 40% and no more than 60% of the total viewport width.
5. WHERE the device viewport width is below 768 pixels, THE App SHALL stack all sections in a single-column layout occupying 100% of the viewport width, with no horizontal scrolling required to view any section.
6. IF the App is loaded in a browser outside the current stable releases of Chrome, Firefox, Edge, and Safari, THEN THE App SHALL display a message indicating the browser is not supported and list the supported browsers.
