import os
import json
import requests
import statistics
from collections import defaultdict
from flask import Flask, request, render_template, Response, jsonify
from dotenv import load_dotenv
import openai
from flask_login import LoginManager, current_user

# ==== Загрузка переменных окружения ====
load_dotenv()

# ==== Flask init ====
app = Flask(__name__, template_folder="templates")
app.secret_key = os.getenv("SECRET_KEY", "mysecretkey123")

# ==== Импорт блюпринтов и User ====
from auth import auth_bp, User
from dashboard import dashboard_bp

# ==== Flask-Login ====
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = "auth.login"

@login_manager.user_loader
def load_user(user_id):
    return User.get(user_id)   # метод get() у тебя уже есть в auth.py

# ==== OpenAI клиент ====
client = openai.OpenAI(
    api_key=os.getenv("OPENAI_API_KEY"),
    organization=os.getenv("OPENAI_ORG_ID") or None
)

# ==== Регистрация блюпринтов ====
app.register_blueprint(auth_bp)
app.register_blueprint(dashboard_bp)


# ==== Основные маршруты ====

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/career")
def career():
    return render_template("career.html")


@app.route("/ai-tree")
def ai_tree():
    return render_template("ai-tree.html")


@app.route("/about")
def about():
    return render_template("o_nas.html")


# ==== API для AI Career ====

@app.route("/career/predict", methods=["POST"])
def predict():
    data = request.get_json()
    skills = data.get("skills", "")
    interests = data.get("interests", "")

    try:
        messages = [
            {
                "role": "system",
                "content": (
                    "Ты — ИИ-помощник по карьере. "
                    "На основе навыков пользователя предложи ТОП-10 подходящих профессий. "
                    "Для каждой профессии укажи: вероятность в %, и что нужно дополнительно изучить. "
                    "Если даны интересы — предложи ещё 10 профессий. "
                    "Формат:\n"
                    "1. **Профессия** - X% совпадение\n"
                    "   • Что изучить: ...\n"
                    "   • Перспективы: ..."
                )
            },
            {"role": "user", "content": f"Навыки: {skills}\nИнтересы: {interests}"}
        ]

        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=messages,
            max_tokens=1500
        )

        result = response.choices[0].message.content.strip()
        return Response(json.dumps({"result": result}, ensure_ascii=False), mimetype="application/json")

    except Exception as e:
        return Response(json.dumps({"error": str(e)}, ensure_ascii=False), mimetype="application/json")


@app.route("/career/relevance", methods=["POST"])
def relevance():
    data = request.get_json()
    professions = data.get("professions", [])
    area_id = data.get("area_id", 40)  # 40 = Казахстан

    try:
        result = []
        for profession in professions:
            url = "https://api.hh.ru/vacancies"
            params = {"text": profession, "area": area_id, "per_page": 100, "period": 30}
            response = requests.get(url, params=params)
            data = response.json()
            vacancies = data.get("items", [])

            salaries = []
            skills_counter = defaultdict(int)

            for v in vacancies:
                salary = v.get("salary")
                if salary and salary.get("from") and salary.get("currency") == "KZT":
                    salaries.append(salary["from"])

                if v.get("key_skills"):
                    for skill in v["key_skills"]:
                        skills_counter[skill["name"].lower()] += 1

            top_skills = sorted(skills_counter.items(), key=lambda x: x[1], reverse=True)[:5]
            avg_salary = int(statistics.mean(salaries)) if salaries else None
            median_salary = int(statistics.median(salaries)) if salaries else None

            params["period"] = 60
            prev_month_response = requests.get(url, params=params)
            prev_month_data = prev_month_response.json()
            prev_month_count = prev_month_data.get("found", 0)
            current_count = data.get("found", 0)

            trend = ""
            if current_count > prev_month_count:
                trend = f"↑ {round((current_count - prev_month_count) / prev_month_count * 100)}%"
            elif current_count < prev_month_count and current_count > 0:
                trend = f"↓ {round((prev_month_count - current_count) / current_count * 100)}%"
            else:
                trend = "→ 0%"

            result.append({
                "profession": profession,
                "vacancy_count": current_count,
                "average_salary": avg_salary,
                "median_salary": median_salary,
                "trend": trend,
                "top_skills": [skill[0] for skill in top_skills],
                "search_url": f"https://hh.kz/search/vacancy?text={profession.replace(' ', '+')}&area={area_id}"
            })

        return Response(json.dumps(result, ensure_ascii=False), mimetype="application/json")

    except Exception as e:
        return Response(json.dumps({"error": str(e)}, ensure_ascii=False), mimetype="application/json")


# ==== API для AI-дерева ====

@app.route("/ai-tree/api/node", methods=["POST"])
def generate_node():
    data = request.get_json()
    path = data.get("path", [])
    step = len(path) + 1

    # Если достигли лимита → тест заканчивается
    if step > 10:
        return jsonify({"question": None, "options": [], "end": True})

    last_answer = path[-1]["answer"] if path else "начало"

    prompt = f"""
Ты создаёшь интерактивное дерево профориентации.
Это вопрос №{step} из 10.
Последний выбор пользователя: \"{last_answer}\".
Сгенерируй новый вопрос (1 строка) и два варианта ответа (по 1 строке).
Формат строго такой:
Вопрос: [текст вопроса]
1. [вариант ответа 1]
2. [вариант ответа 2]
"""

    response = client.chat.completions.create(
        model="gpt-4",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.7,
    )

    raw_text = response.choices[0].message.content.strip()
    lines = [l.strip() for l in raw_text.split("\n") if l.strip()]

    question = lines[0].replace("Вопрос:", "").strip()
    options = [l[2:].strip() for l in lines[1:] if l.startswith(("1.", "2."))]

    if len(options) < 2:
        options = ["Вариант А", "Вариант Б"]

    return jsonify({"question": question, "options": options, "step": step, "end": False})





@app.route("/ai-tree/api/result", methods=["POST"])
def generate_result():
    data = request.get_json()
    path = data.get("path", [])
    dialogue = "\n".join([f"{i+1}) Вопрос: {item['question']} — Ответ: {item['answer']}" for i, item in enumerate(path)])

    prompt = f"""
Пользователь прошёл профориентационный тест.
Вот его путь:
{dialogue}
В начале ответа напиши "Профессия: ..." (только название).
Затем объясни в 2-4 предложениях, почему именно эта профессия подходит.
"""

    response = client.chat.completions.create(
        model="gpt-4",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.7,
    )

    result = response.choices[0].message.content.strip()
    return jsonify({"profession": result})


@app.route("/ai-tree/api/vacancies", methods=["POST"])
def get_vacancies():
    data = request.get_json()
    profession = data.get("profession", "")

    # Очищаем строку от "Профессия:" и лишнего текста
    if ":" in profession:
        profession = profession.split(":")[1].strip()
    if "." in profession:
        profession = profession.split(".")[0].strip()

    url = "https://api.hh.ru/vacancies"   # общий API
    areas = [159, 40, 1]  # Казахстан, Россия, fallback = Москва
    vacancies = []

    for area in areas:
        params = {"text": profession, "area": area, "per_page": 10}
        r = requests.get(url, params=params, timeout=10)
        res = r.json()

        for v in res.get("items", []):
            salary = v.get("salary")
            salary_str = None
            if salary:
                frm = salary.get("from") or ""
                to = salary.get("to") or ""
                cur = salary.get("currency") or ""
                salary_str = f"{frm}–{to} {cur}".strip("– ")

            vacancies.append({
                "name": v.get("name"),
                "company": v.get("employer", {}).get("name"),
                "url": v.get("alternate_url"),
                "salary": salary_str
            })

        if vacancies:
            break  # нашли вакансии — выходим

    return jsonify({"vacancies": vacancies})


@app.route("/assistant/chat", methods=["POST"])
def assistant_chat():
    data = request.get_json()
    user_message = data.get("message", "")

    if not user_message:
        return jsonify({"reply": "Сұрақты жазыңыз 🙂"})

    try:
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "Ты дружелюбный AI-ассистент платформы QadamDapp. Помогаешь с профориентацией, обучением и навигацией по сайту."},
                {"role": "user", "content": user_message}
            ],
            max_tokens=500
        )

        reply = response.choices[0].message.content.strip()
        return jsonify({"reply": reply})

    except Exception as e:
        return jsonify({"reply": f"Ошибка: {str(e)}"})


# ==== Запуск ====
if __name__ == "__main__":
    app.run(debug=True, port=8080)
