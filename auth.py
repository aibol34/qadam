from flask import Blueprint, render_template, request, redirect, url_for, flash
from flask_login import UserMixin, login_user, logout_user, login_required
import sqlite3
import os

auth_bp = Blueprint("auth", __name__, url_prefix="/auth")

DB_PATH = "users.db"

# ====== DB init ======
def init_db():
    if not os.path.exists(DB_PATH):
        with sqlite3.connect(DB_PATH) as conn:
            conn.execute("""
            CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE,
                email TEXT UNIQUE,
                password TEXT
            )
            """)
        print("Создана БД users.db")

init_db()

# ====== User class ======
class User(UserMixin):
    def __init__(self, id, username, email, password):
        self.id = str(id)
        self.username = username
        self.email = email
        self.password = password

    @staticmethod
    def get(user_id):
        with sqlite3.connect(DB_PATH) as conn:
            cur = conn.cursor()
            cur.execute("SELECT id, username, email, password FROM users WHERE id=?", (user_id,))
            row = cur.fetchone()
        return User(*row) if row else None

    @staticmethod
    def find_by_username(username):
        with sqlite3.connect(DB_PATH) as conn:
            cur = conn.cursor()
            cur.execute("SELECT id, username, email, password FROM users WHERE username=?", (username,))
            row = cur.fetchone()
        return User(*row) if row else None

    @staticmethod
    def create(username, email, password):
        with sqlite3.connect(DB_PATH) as conn:
            cur = conn.cursor()
            cur.execute("INSERT INTO users (username, email, password) VALUES (?, ?, ?)", (username, email, password))
            conn.commit()
            return User(cur.lastrowid, username, email, password)

# ====== Routes ======
@auth_bp.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        username = request.form["username"]
        password = request.form["password"]

        user = User.find_by_username(username)
        if user and user.password == password:
            login_user(user)
            flash("Вы успешно вошли!", "success")
            return redirect(url_for("index"))
        else:
            flash("Неверный логин или пароль", "error")

    return render_template("login.html")

@auth_bp.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        username = request.form["username"]
        email = request.form["email"]
        password = request.form["password"]

        if User.find_by_username(username):
            flash("Такой пользователь уже существует!", "error")
        else:
            user = User.create(username, email, password)
            login_user(user)
            flash("Регистрация прошла успешно!", "success")
            return redirect(url_for("index"))

    return render_template("register.html")

@auth_bp.route("/logout")
@login_required
def logout():
    logout_user()
    flash("Вы вышли из системы", "info")
    return redirect(url_for("index"))
