from flask import Flask
import os
from .routes import main
# this file is to run the app, it calls the blueprint of main from init, which calls from route. All this is done so it is modular.

app = Flask(__name__)
app.secret_key = os.getenv('FLASK_SECRET_KEY', 'your_default_secret_key')
app.register_blueprint(main)

if __name__ == "__main__":
    app.run(debug=True)  # run the app after it's created
