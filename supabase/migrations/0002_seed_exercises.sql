-- Seed: 50 common exercises, visible to everyone. Run once after 0001_schema.sql.
-- Safe to re-run: it does nothing if global exercises already exist.
insert into exercises (name_ar, name_en, muscle, equipment, is_global)
select v.name_ar, v.name_en, v.muscle, v.equipment, true
from (values
  -- chest
  ('ضغط الصدر بالبار',                 'Barbell Bench Press',          'chest',      'barbell'),
  ('ضغط الصدر المائل بالبار',           'Incline Barbell Bench Press',  'chest',      'barbell'),
  ('ضغط الصدر بالدمبل',                'Dumbbell Bench Press',         'chest',      'dumbbell'),
  ('ضغط الصدر المائل بالدمبل',          'Incline Dumbbell Press',       'chest',      'dumbbell'),
  ('ضغط الصدر على الجهاز',             'Machine Chest Press',          'chest',      'machine'),
  ('تفتيح الصدر بالكيبل',              'Cable Fly',                    'chest',      'cable'),
  ('تفتيح الصدر على الجهاز',           'Pec Deck Fly',                 'chest',      'machine'),
  ('تمرين الضغط',                      'Push-Up',                      'chest',      'bodyweight'),
  -- back
  ('الرفعة الميتة',                    'Deadlift',                     'back',       'barbell'),
  ('تجديف بالبار',                     'Barbell Row',                  'back',       'barbell'),
  ('تجديف بالدمبل بيد واحدة',           'One-Arm Dumbbell Row',         'back',       'dumbbell'),
  ('سحب أمامي واسع',                   'Lat Pulldown',                 'back',       'cable'),
  ('تجديف جالس بالكيبل',               'Seated Cable Row',             'back',       'cable'),
  ('العقلة',                           'Pull-Up',                      'back',       'bodyweight'),
  ('تجديف على الجهاز',                 'Machine Row',                  'back',       'machine'),
  ('سحب للوجه',                        'Face Pull',                    'shoulders',  'cable'),
  -- shoulders
  ('ضغط الأكتاف بالبار',               'Overhead Press',               'shoulders',  'barbell'),
  ('ضغط الأكتاف بالدمبل',              'Dumbbell Shoulder Press',      'shoulders',  'dumbbell'),
  ('ضغط الأكتاف على الجهاز',           'Machine Shoulder Press',       'shoulders',  'machine'),
  ('رفرفة جانبية بالدمبل',             'Dumbbell Lateral Raise',       'shoulders',  'dumbbell'),
  ('رفرفة جانبية بالكيبل',             'Cable Lateral Raise',          'shoulders',  'cable'),
  ('رفرفة خلفية على الجهاز',           'Reverse Pec Deck',             'shoulders',  'machine'),
  -- biceps
  ('تبادل بايسبس بالبار',              'Barbell Curl',                 'biceps',     'barbell'),
  ('تبادل بايسبس بالدمبل',             'Dumbbell Curl',                'biceps',     'dumbbell'),
  ('تبادل مطرقة',                      'Hammer Curl',                  'biceps',     'dumbbell'),
  ('بايسبس على مقعد الارتكاز',         'Preacher Curl',                'biceps',     'machine'),
  ('بايسبس بالكيبل',                   'Cable Curl',                   'biceps',     'cable'),
  -- triceps
  ('ترايسبس ضغط للأسفل بالكيبل',       'Triceps Pushdown',             'triceps',    'cable'),
  ('ترايسبس خلف الرأس بالكيبل',        'Overhead Cable Triceps Extension', 'triceps', 'cable'),
  ('ترايسبس بالبار مستلقياً',          'Skull Crusher',                'triceps',    'barbell'),
  ('المتوازي',                         'Dip',                          'triceps',    'bodyweight'),
  ('ضغط بقبضة ضيقة',                   'Close-Grip Bench Press',       'triceps',    'barbell'),
  -- forearms
  ('ثني الرسغ بالدمبل',                'Wrist Curl',                   'forearms',   'dumbbell'),
  -- quads
  ('سكوات بالبار',                     'Barbell Squat',                'quads',      'barbell'),
  ('ضغط الأرجل',                       'Leg Press',                    'quads',      'machine'),
  ('هاك سكوات',                        'Hack Squat',                   'quads',      'machine'),
  ('تمديد الأرجل',                     'Leg Extension',                'quads',      'machine'),
  ('سكوات بلغاري',                     'Bulgarian Split Squat',        'quads',      'dumbbell'),
  ('الطعن بالدمبل',                    'Dumbbell Lunge',               'quads',      'dumbbell'),
  ('سكوات الكأس',                      'Goblet Squat',                 'quads',      'dumbbell'),
  -- hamstrings
  ('الرفعة الرومانية',                 'Romanian Deadlift',            'hamstrings', 'barbell'),
  ('ثني الأرجل مستلقياً',              'Lying Leg Curl',               'hamstrings', 'machine'),
  ('ثني الأرجل جالساً',                'Seated Leg Curl',              'hamstrings', 'machine'),
  -- glutes
  ('دفع الورك بالبار',                 'Hip Thrust',                   'glutes',     'barbell'),
  ('رفس خلفي بالكيبل',                 'Cable Glute Kickback',         'glutes',     'cable'),
  -- calves
  ('رفع السمانة واقفاً',               'Standing Calf Raise',          'calves',     'machine'),
  ('رفع السمانة جالساً',               'Seated Calf Raise',            'calves',     'machine'),
  -- core
  ('بلانك',                            'Plank',                        'core',       'bodyweight'),
  ('طحن البطن بالكيبل',                'Cable Crunch',                 'core',       'cable'),
  ('رفع الأرجل معلقاً',                'Hanging Leg Raise',            'core',       'bodyweight')
) as v(name_ar, name_en, muscle, equipment)
where not exists (select 1 from exercises where is_global);
