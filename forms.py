from flask_wtf import FlaskForm
from wtforms import (
    StringField, PasswordField, BooleanField, SubmitField, 
    SelectField, FloatField, TextAreaField, FileField, DateTimeField,
    HiddenField
)
from wtforms.validators import DataRequired, Length, Email, EqualTo, ValidationError, Optional, NumberRange
from models import User, Courier
from flask_wtf.file import FileAllowed

# Formularze podstawowe (logowanie, rejestracja)
class LoginForm(FlaskForm):
    username = StringField('Nazwa użytkownika', validators=[DataRequired()])
    password = PasswordField('Hasło', validators=[DataRequired()])
    remember = BooleanField('Zapamiętaj mnie')
    submit = SubmitField('Zaloguj się')

class RegistrationForm(FlaskForm):
    username = StringField('Nazwa użytkownika', validators=[
        DataRequired(), 
        Length(min=3, max=80, message='Nazwa użytkownika musi mieć od 3 do 80 znaków')
    ])
    email = StringField('Email', validators=[
        DataRequired(), 
        Email(message='Wprowadź poprawny adres email')
    ])
    password = PasswordField('Hasło', validators=[
        DataRequired(),
        Length(min=6, message='Hasło musi mieć co najmniej 6 znaków')
    ])
    password2 = PasswordField('Powtórz hasło', validators=[
        DataRequired(),
        EqualTo('password', message='Hasła muszą być identyczne')
    ])
    first_name = StringField('Imię')
    last_name = StringField('Nazwisko')
    phone = StringField('Telefon')
    is_courier = BooleanField('Rejestruję się jako kurier')
    submit = SubmitField('Zarejestruj się')
    
    def validate_username(self, username):
        """Sprawdza, czy nazwa użytkownika jest już zajęta"""
        user = User.query.filter_by(username=username.data).first()
        if user:
            raise ValidationError('Ta nazwa użytkownika jest już zajęta. Wybierz inną.')
            
    def validate_email(self, email):
        """Sprawdza, czy email jest już zajęty"""
        user = User.query.filter_by(email=email.data).first()
        if user:
            raise ValidationError('Ten adres email jest już zarejestrowany. Użyj innego adresu lub zaloguj się.')

# Formularz profilu kuriera
class CourierProfileForm(FlaskForm):
    vehicle_types = [
        ('bike', 'Rower'),
        ('scooter', 'Skuter'),
        ('car', 'Samochód osobowy'),
        ('van', 'Van/Dostawczy'),
        ('truck', 'Ciężarówka')
    ]
    
    vehicle_type = SelectField('Typ pojazdu', choices=vehicle_types, validators=[DataRequired()])
    license_plate = StringField('Numer rejestracyjny', validators=[Optional()])
    max_weight = FloatField('Maksymalna waga przesyłek (kg)', validators=[
        Optional(),
        NumberRange(min=0, max=10000, message='Podaj prawidłową wartość (0-10000 kg)')
    ])
    work_zone = StringField('Preferowana strefa pracy', validators=[Optional()])
    profile_picture = FileField('Zdjęcie profilowe', validators=[
        Optional(),
        FileAllowed(['jpg', 'png', 'jpeg'], 'Dozwolone tylko pliki obrazów (jpg, png)')
    ])
    additional_info = TextAreaField('Dodatkowe informacje', validators=[Optional()])
    submit = SubmitField('Zapisz profil')

# Formularz dostawy
class DeliveryForm(FlaskForm):
    package_id = StringField('ID Przesyłki', validators=[Optional()])
    package_description = TextAreaField('Opis przesyłki', validators=[Optional()])
    weight = FloatField('Waga (kg)', validators=[
        Optional(),
        NumberRange(min=0, message='Waga musi być większa od 0')
    ])
    
    recipient_name = StringField('Nazwa odbiorcy', validators=[DataRequired()])
    recipient_phone = StringField('Telefon odbiorcy', validators=[Optional()])
    recipient_email = StringField('Email odbiorcy', validators=[Optional(), Email()])
    
    pickup_address = StringField('Adres odbioru', validators=[DataRequired()])
    pickup_lat = HiddenField('Szerokość geograficzna odbioru')
    pickup_lng = HiddenField('Długość geograficzna odbioru')
    delivery_address = StringField('Adres dostawy', validators=[DataRequired()])
    delivery_lat = HiddenField('Szerokość geograficzna dostawy')
    delivery_lng = HiddenField('Długość geograficzna dostawy')
    
    estimated_delivery_time = DateTimeField('Szacowany czas dostawy', 
                                           format='%Y-%m-%d %H:%M',
                                           validators=[Optional()])
    
    notes = TextAreaField('Uwagi', validators=[Optional()])
    route_id = HiddenField('ID Trasy')
    
    submit = SubmitField('Utwórz dostawę')

# Formularz aktualizacji statusu dostawy
class DeliveryStatusUpdateForm(FlaskForm):
    status_choices = [
        ('new', 'Nowa'),
        ('assigned', 'Przypisana'),
        ('in_progress', 'W realizacji'),
        ('picked_up', 'Odebrana od nadawcy'),
        ('in_transit', 'W drodze'),
        ('out_for_delivery', 'W trakcie dostarczania'),
        ('delivered', 'Dostarczona'),
        ('failed', 'Nieudana próba dostarczenia'),
        ('cancelled', 'Anulowana')
    ]
    
    status = SelectField('Status', choices=status_choices, validators=[DataRequired()])
    notes = TextAreaField('Komentarz', validators=[Optional()])
    delivery_photo = FileField('Zdjęcie potwierdzające dostawę', validators=[
        Optional(),
        FileAllowed(['jpg', 'png', 'jpeg'], 'Dozwolone tylko pliki obrazów (jpg, png)')
    ])
    current_lat = HiddenField('Szerokość geograficzna')
    current_lng = HiddenField('Długość geograficzna')
    
    submit = SubmitField('Aktualizuj status')

# Formularz aktualizacji statusu kuriera
class CourierStatusForm(FlaskForm):
    status_choices = [
        ('online', 'Dostępny'),
        ('busy', 'Zajęty'),
        ('offline', 'Niedostępny')
    ]
    
    status = SelectField('Status', choices=status_choices, validators=[DataRequired()])
    submit = SubmitField('Aktualizuj status')

# Formularz filtrowania dostaw
class DeliveryFilterForm(FlaskForm):
    status = SelectField('Status', choices=[
        ('all', 'Wszystkie'),
        ('new', 'Nowe'),
        ('assigned', 'Przypisane'),
        ('in_progress', 'W realizacji'),
        ('delivered', 'Dostarczone'),
        ('failed', 'Nieudane')
    ], default='all')
    
    date_from = DateTimeField('Od daty', format='%Y-%m-%d', validators=[Optional()])
    date_to = DateTimeField('Do daty', format='%Y-%m-%d', validators=[Optional()])
    
    search = StringField('Szukaj')
    
    submit = SubmitField('Filtruj')