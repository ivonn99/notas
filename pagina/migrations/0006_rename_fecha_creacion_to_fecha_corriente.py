# Generated manually

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('pagina', '0005_add_usuario_vendedor_pv'),
    ]

    operations = [
        migrations.RenameField(
            model_name='notacredito',
            old_name='fecha_creacion',
            new_name='fecha_corriente',
        ),
    ]




