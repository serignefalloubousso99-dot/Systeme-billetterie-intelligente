/**
 * Bascule l'environnement en mode test.
 *
 * Ce module doit être évalué AVANT tout autre : config/database.js lit
 * NODE_ENV dès son import pour choisir entre la base de développement et
 * celle de test. Les modules ES étant évalués dans l'ordre des imports,
 * il suffit que helpers.js l'importe en premier.
 *
 * L'affectation est faite ici plutôt que dans le script npm : sous Windows,
 * la syntaxe `NODE_ENV=test node ...` n'est pas interprétée par cmd.exe, et
 * les tests iraient alors écrire dans la base de développement.
 */
process.env.NODE_ENV = 'test';
