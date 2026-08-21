// @ts-check

/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  await knex.schema.createTable('resource_groups', table => {
    table.string('id').primary();
    table
      .string('tenant_key')
      .notNullable()
      .comment('`${clientCode}:${tenantId}` this resource group belongs to');
    table.string('target').notNullable().comment("'azure' or 'onprem'");
    table.string('name').notNullable();
    table.string('description');
    table.string('external_id').comment('Real Azure resource group ID once provisioned');
    table.string('status').notNullable().defaultTo('pending');
    table.string('error');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.unique(['tenant_key', 'name']);
  });

  await knex.schema.createTable('network_security_groups', table => {
    table.string('id').primary();
    table
      .string('resource_group_id')
      .notNullable()
      .references('id')
      .inTable('resource_groups')
      .onDelete('CASCADE');
    table.string('name').notNullable();
    table.string('external_id');
    table.string('status').notNullable().defaultTo('pending');
    table.string('error');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.unique(['resource_group_id', 'name']);
  });

  await knex.schema.createTable('nsg_rules', table => {
    table.string('id').primary();
    table
      .string('nsg_id')
      .notNullable()
      .references('id')
      .inTable('network_security_groups')
      .onDelete('CASCADE');
    table.string('name').notNullable();
    table.integer('priority').notNullable();
    table.string('direction').notNullable().comment("'inbound' or 'outbound'");
    table.string('access').notNullable().comment("'allow' or 'deny'");
    table.string('protocol').notNullable().comment("'tcp', 'udp', or '*'");
    table.string('source_address_prefix').notNullable();
    table.string('source_port_range').notNullable();
    table.string('destination_address_prefix').notNullable();
    table.string('destination_port_range').notNullable();
    table.string('status').notNullable().defaultTo('pending');
    table.string('error');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.unique(['nsg_id', 'name']);
    table.unique(['nsg_id', 'priority']);
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  await knex.schema.dropTable('nsg_rules');
  await knex.schema.dropTable('network_security_groups');
  await knex.schema.dropTable('resource_groups');
};
