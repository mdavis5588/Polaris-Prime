// @ts-check

/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  await knex.schema.createTable('service_deployments', table => {
    table.string('id').primary();
    table
      .string('resource_group_id')
      .notNullable()
      .references('id')
      .inTable('resource_groups')
      .onDelete('CASCADE');
    table.string('nsg_id').references('id').inTable('network_security_groups').onDelete('SET NULL');
    table.string('name').notNullable();
    table.string('vm_size').notNullable();
    table.string('admin_username').notNullable();
    table.string('external_id');
    table.string('console_url');
    table.string('status').notNullable().defaultTo('pending');
    table.string('error');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.unique(['resource_group_id', 'name']);
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  await knex.schema.dropTable('service_deployments');
};
