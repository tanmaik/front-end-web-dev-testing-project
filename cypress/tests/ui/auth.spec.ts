import { User } from "../../../src/models";
import { isMobile } from "../../support/utils";

const apiGraphQL = `${Cypress.env("apiUrl")}/graphql`;

describe("User Sign-up and Login", function () {
  beforeEach(function () {
    cy.task("db:seed");

    cy.intercept("POST", "/users").as("signup");
    cy.intercept("POST", apiGraphQL, (req) => {
      const { body } = req;

      if (body.hasOwnProperty("operationName") && body.operationName === "CreateBankAccount") {
        req.alias = "gqlCreateBankAccountMutation";
      }
    });
  });

  it("should redirect unauthenticated user to signin page", function () {
    cy.visit("/personal");
    cy.location("pathname").should("equal", "/signin");
    cy.visualSnapshot("Redirect to SignIn");
  });

  it("should redirect to the home page after login", function () {
    cy.database("find", "users").then((user: User) => {
      cy.login(user.username, "s3cret", { rememberUser: true });
    });
    cy.location("pathname").should("equal", "/");
  });

  it("should remember a user for 30 days after login", function () {
    cy.database("find", "users").then((user: User) => {
      cy.login(user.username, "s3cret", { rememberUser: true });
    });

    // Verify Session Cookie
    cy.getCookie("connect.sid").should("have.property", "expiry");

    // Logout User
    if (isMobile()) {
      cy.getBySel("sidenav-toggle").click();
    }
    cy.getBySel("sidenav-signout").click();
    cy.location("pathname").should("eq", "/signin");
    cy.visualSnapshot("Redirect to SignIn");
  });

  it("should display login errors", function () {
    cy.visit("/");

    cy.getBySel("signin-username").type("User").find("input").clear().blur();
    cy.get("#username-helper-text").should("be.visible").and("contain", "Username is required");
    cy.visualSnapshot("Display Username is Required Error");

    cy.getBySel("signin-password").type("abc").find("input").blur();
    cy.get("#password-helper-text")
      .should("be.visible")
      .and("contain", "Password must contain at least 4 characters");
    cy.visualSnapshot("Display Password Error");

    cy.getBySel("signin-submit").should("be.disabled");
    cy.visualSnapshot("Sign In Submit Disabled");
  });

  it("should display signup errors", function () {
    cy.intercept("GET", "/signup");

    cy.visit("/signup");

    cy.getBySel("signup-first-name").type("First").find("input").clear().blur();
    cy.get("#firstName-helper-text").should("be.visible").and("contain", "First Name is required");

    cy.getBySel("signup-last-name").type("Last").find("input").clear().blur();
    cy.get("#lastName-helper-text").should("be.visible").and("contain", "Last Name is required");

    cy.getBySel("signup-username").type("User").find("input").clear().blur();
    cy.get("#username-helper-text").should("be.visible").and("contain", "Username is required");

    cy.getBySel("signup-password").type("password").find("input").clear().blur();
    cy.get("#password-helper-text").should("be.visible").and("contain", "Enter your password");

    cy.getBySel("signup-confirmPassword").type("DIFFERENT PASSWORD").find("input").blur();
    cy.get("#confirmPassword-helper-text")
      .should("be.visible")
      .and("contain", "Password does not match");
    cy.visualSnapshot("Display Sign Up Required Errors");

    cy.getBySel("signup-submit").should("be.disabled");
    cy.visualSnapshot("Sign Up Submit Disabled");
  });

  it("should error for an invalid user", function () {
    cy.login("invalidUserName", "invalidPa$$word");

    cy.getBySel("signin-error")
      .should("be.visible")
      .and("have.text", "Username or password is invalid");
    cy.visualSnapshot("Sign In, Invalid Username and Password, Username or Password is Invalid");
  });

  it("should error for an invalid password for existing user", function () {
    cy.database("find", "users").then((user: User) => {
      cy.login(user.username, "INVALID");
    });

    cy.getBySel("signin-error")
      .should("be.visible")
      .and("have.text", "Username or password is invalid");
    cy.visualSnapshot("Sign In, Invalid Username, Username or Password is Invalid");
  });

  it("should allow a visitor to sign-up, login, and logout", function () {
    // Generate a random username to avoid conflicts with existing users
    const username = `testuser${Math.floor(Math.random() * 10000)}`;
    const password = "s3cret";
    const firstName = "Test";
    const lastName = "User";

    // Visit the sign-up page
    cy.visit("/signup");

    // Fill in the sign-up form
    cy.getBySel("signup-first-name").type(firstName);
    cy.getBySel("signup-last-name").type(lastName);
    cy.getBySel("signup-username").type(username);
    cy.getBySel("signup-password").type(password);
    cy.getBySel("signup-confirmPassword").type(password);
    cy.visualSnapshot("Sign Up Form Filled");

    // Submit the form
    cy.getBySel("signup-submit").click();

    // Wait for signup request to complete
    cy.wait("@signup");

    // After signup, we should be redirected to the signin page
    cy.location("pathname").should("eq", "/signin");
    cy.visualSnapshot("Redirected to Sign In");

    // Login with the newly created credentials
    cy.getBySel("signin-username").type(username);
    cy.getBySel("signin-password").type(password);
    cy.getBySel("signin-submit").click();

    // After first login, the onboarding dialog should appear
    // Verify we're logged in
    cy.getBySel("sidenav-username").should("contain", username);

    // Handle the onboarding dialog - click the NEXT button
    cy.getBySel("user-onboarding-next").click();

    // Now we should be on the create bank account form
    cy.getBySelLike("bankName-input").type("Test Bank");
    cy.getBySelLike("routingNumber-input").type("123456789");
    cy.getBySelLike("accountNumber-input").type("987654321");
    cy.visualSnapshot("Bank Account Form Filled");

    // Submit the bank account form
    cy.getBySelLike("submit").click();

    cy.getBySel("user-onboarding-next").click();

    // Logout
    // Handle mobile vs desktop view
    if (isMobile()) {
      cy.getBySel("sidenav-toggle").click();
    }
    cy.getBySel("sidenav-signout").click();

    // Verify we're logged out and redirected to sign-in page
    cy.location("pathname").should("eq", "/signin");
    cy.visualSnapshot("Logged Out");
  });
});
