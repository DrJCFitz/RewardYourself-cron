#!/bin/bash
aws ecs list-task-definitions --family-prefix cron
aws ecs run-task --cluster default --task-definition cron:4 --count 1
sleep 60
aws ecs run-task --cluster default --task-definition cron:5 --count 1