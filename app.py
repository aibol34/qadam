from flask import Flask, request, render_template, Response
from dotenv import load_dotenv
from flask import jsonify
import openai
import os
import json
import requests
from collections import defaultdict
import statistics




load_dotenv()

client = openai.OpenAI(
    api_key=os.getenv("OPENAI_API_KEY"),
    organization=os.getenv("OPENAI_ORG_ID") or None
)

app = Flask(__name__, template_folder='templates')

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/career')
def career():
    return render_template('career.html')

@app.errorhandler(404)
def page_not_found(e):
    return render_template('404.html'), 404

@app.route('/career/predict', methods=['POST'])
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
                    "Если даны интересы — предложи ещё 10 профессий, которые стоит рассмотреть, если пользователь хочет "
                    "развиваться в этих интересах. Ответ строго на русском языке, структурированный. "
                    "Формат вывода:\n"
                    "1. **Профессия** - X% совпадение\n"
                    "   • Что изучить: ...\n"
                    "   • Перспективы: ...\n"
                    "2. **Профессия** - X% совпадение\n"
                    "   ... и так далее"
                )
            },
            {
                "role": "user",
                "content": f"Навыки: {skills}\nИнтересы: {interests}"
            }
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


@app.route('/career/relevance', methods=['POST'])
def relevance():
    data = request.get_json()
    professions = data.get("professions", [])
    area_id = data.get("area_id", 40)  # 40 = Казахстан

    try:
        result = []
        for profession in professions:
            # Получаем данные по вакансиям
            url = "https://api.hh.ru/vacancies"
            params = {
                "text": profession,
                "area": area_id,
                "per_page": 100,
                "period": 30  # Вакансии за последние 30 дней
            }
            response = requests.get(url, params=params)
            data = response.json()
            vacancies = data.get("items", [])

            # Собираем статистику по зарплатам
            salaries = []
            skills_counter = defaultdict(int)

            for v in vacancies:
                salary = v.get("salary")
                if salary and salary.get("from") and salary.get("currency") == "KZT":
                    salaries.append(salary["from"])

                # Анализ требуемых навыков
                if v.get("key_skills"):
                    for skill in v["key_skills"]:
                        skills_counter[skill["name"].lower()] += 1

            # Топ-5 востребованных навыков
            top_skills = sorted(skills_counter.items(), key=lambda x: x[1], reverse=True)[:5]

            # Средняя и медианная зарплата
            avg_salary = int(statistics.mean(salaries)) if salaries else None
            median_salary = int(statistics.median(salaries)) if salaries else None

            # Динамика (сравнение с прошлым месяцем)
            params["period"] = 60
            prev_month_response = requests.get(url, params=params)
            prev_month_data = prev_month_response.json()
            prev_month_count = prev_month_data.get("found", 0)
            current_count = data.get("found", 0)

            trend = ""
            if current_count > prev_month_count:
                trend = f"↑ {round((current_count - prev_month_count) / prev_month_count * 100)}%"
            elif current_count < prev_month_count:
                trend = f"↓ {round((prev_month_count - current_count) / prev_month_count * 100)}%"
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


@app.route("/ai-tree")
def ai_tree():
    return render_template("ai-tree.html")

@app.route("/about")
def about():
    return render_template("o_nas.html")

@app.route("/ai-tree/api/node", methods=["POST"])
def generate_node():
    data = request.get_json()
    path = data.get("path", [])

    last_answer = path[-1]["answer"] if path else "начало"

    prompt = f"""
Ты создаёшь интерактивное дерево профориентации.
Последний выбор пользователя: \"{last_answer}\".
Сгенерируй один вопрос с двумя вариантами ответа основывая на этом ответе, но вопросы не должны повторяться и должны быть ориентированные на рабочие профессии. 
Формат:
Вопрос: ...
1. Вариант 1
2. Вариант 2
"""

    response = openai.chat.completions.create(
        model="gpt-4",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.8,
    )

    content = response.choices[0].message.content.strip()
    lines = content.split("\n")
    question = lines[0].replace("Вопрос: ", "").strip()
    options = [line.replace("1.", "").replace("2.", "").strip() for line in lines[1:3]]

    return jsonify({"question": question, "options": options})

@app.route("/ai-tree/api/result", methods=["POST"])
def generate_result():
    data = request.get_json()
    path = data.get("path", [])

    dialogue = "\n".join([f"{i+1}) Вопрос: {item['question']} — Ответ: {item['answer']}" for i, item in enumerate(path)])

    prompt = f"""Пользователь прошёл профориентационный тест.
Вот его путь:
{dialogue}
В начале ответа ОБЯЗАТЕЛЬНО напиши строку "Профессия: ...", где ... — только короткое название профессии (без лишних слов).
Затем обязательно дай объяснение в 2-4 предложениях, почему ты выбрал именно её.
"""

    response = openai.chat.completions.create(
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
    url = "https://api.hh.kz/vacancies"
    params = {
        "text": profession,
        "area": 159,    # 159 — Казахстан
        "per_page": 5
    }
    r = requests.get(url, params=params, timeout=10)
    res = r.json()
    vacancies = []
    for v in res.get('items', []):
        salary = v.get("salary")
        salary_str = None
        if salary:
            frm = salary.get("from") or ""
            to = salary.get("to") or ""
            cur = salary.get("currency") or ""
            salary_str = f"{frm}–{to} {cur}".replace("– ", "").strip()
        vacancies.append({
            "name": v.get("name"),
            "company": v.get("employer", {}).get("name"),
            "url": v.get("alternate_url"),
            "salary": salary_str
        })
    return jsonify({"vacancies": vacancies})



@app.errorhandler(404)
def page_not_found(e):
    return render_template('404.html'), 404


if __name__ == '__main__':
    app.run(debug=True, port=8080)
