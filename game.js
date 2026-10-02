"use strict";

document.addEventListener("DOMContentLoaded", () => {

    const login = document.getElementById("login");
    const home = document.getElementById("home");

    const usernameInput =
        document.getElementById("username");

    const loginButton =
        document.getElementById("loginButton");

    const profileName =
        document.getElementById("profileName");

    const profileAvatar =
        document.getElementById("profileAvatar");


    function entrar() {

        const nome =
            usernameInput.value.trim();

        if (!nome) {
            usernameInput.focus();
            return;
        }

        localStorage.setItem(
            "shadow_games_username",
            nome.slice(0, 16)
        );

        if (profileName) {
            profileName.textContent =
                nome.slice(0, 16);
        }

        if (profileAvatar) {
            profileAvatar.textContent =
                nome.charAt(0).toUpperCase();
        }

        login.classList.add("hidden");
        home.classList.remove("hidden");
    }


    loginButton.addEventListener(
        "click",
        entrar
    );


    usernameInput.addEventListener(
        "keydown",
        (event) => {

            if (event.key === "Enter") {
                entrar();
            }

        }
    );


    const salvo =
        localStorage.getItem(
            "shadow_games_username"
        );

    if (salvo) {

        usernameInput.value = salvo;

        if (profileName) {
            profileName.textContent = salvo;
        }

        if (profileAvatar) {
            profileAvatar.textContent =
                salvo.charAt(0).toUpperCase();
        }

        login.classList.add("hidden");
        home.classList.remove("hidden");
    }

});
