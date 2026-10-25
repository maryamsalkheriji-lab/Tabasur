-- أمر واحد؛ لا يحتاج جدولًا مؤقتًا أو جلسة SQL سابقة.
DO $$
DECLARE
  target_event uuid;
  criterion_names text[] := ARRAY[
    'اكتمال المنتج وعمله فعليًا',
    'معالجة المشكلة وملاءمة الحل',
    'جودة التنفيذ التقني',
    'الاختبار وإثبات فاعلية المنتج',
    'توظيف تقنيات الذكاء الاصطناعي',
    'الجدوى وقابلية التطوير',
    'العرض النهائي والتجربة المباشرة'
  ];
  criterion_questions text[] := ARRAY[
    'هل يعمل المنتج فعليًا ويتيح إكمال الاستخدام الأساسي من البداية إلى النهاية دون عوائق جوهرية؟',
    'هل يعالج المنتج مشكلة واضحة للمستفيد المستهدف ويقدم حلًا ملائمًا مدعومًا بأدلة؟',
    'هل التنفيذ التقني منظم وموثوق، وتتكامل مكوناته مع معالجة الأخطاء وحماية البيانات؟',
    'هل اختُبر المنتج مع مستخدمين أو حالات واقعية وأظهرت النتائج فاعليته بمؤشرات واضحة؟',
    'هل يوظف المنتج الذكاء الاصطناعي فعليًا في وظيفة مفيدة وملائمة، مع التحقق من جودة المخرجات وحدودها؟',
    'هل توجد خطة واقعية لتشغيل المنتج واستدامته وتطويره بناءً على الموارد والتكلفة واحتياج السوق؟',
    'هل يشرح العرض المنتج وقيمته بوضوح ويعرض تجربة مباشرة ودقيقة لما يعمل فعليًا؟'
  ];
  criterion_weights numeric[] := ARRAY[30, 15, 15, 15, 10, 10, 5];
  already_updated boolean;
BEGIN
  SELECT id INTO target_event
  FROM public.jd_events
  WHERE slug = 'ai-hackathon'
  FOR UPDATE;

  IF target_event IS NULL THEN
    RAISE EXCEPTION 'الفعالية ai-hackathon غير موجودة؛ لم يُغيّر شيء';
  END IF;

  LOCK TABLE public.jd_criteria, public.jd_scores
    IN SHARE ROW EXCLUSIVE MODE;

  SELECT
    array_agg(c.name ORDER BY c.sort_order, c.id) = criterion_names
    AND array_agg(c.weight ORDER BY c.sort_order, c.id) = criterion_weights
  INTO already_updated
  FROM public.jd_criteria c
  WHERE c.event_id = target_event;

  IF coalesce(already_updated, false) THEN
    -- إعادة التشغيل تحفظ تقييمات المعايير الجديدة.
    UPDATE public.jd_criteria c
    SET description = criterion_questions[i], sort_order = i
    FROM generate_subscripts(criterion_names, 1) AS indexes(i)
    WHERE c.event_id = target_event AND c.name = criterion_names[i];
  ELSE
    DELETE FROM public.jd_scores
    WHERE criterion_id IN (
      SELECT id FROM public.jd_criteria WHERE event_id = target_event
    );

    DELETE FROM public.jd_criteria WHERE event_id = target_event;

    INSERT INTO public.jd_criteria
      (event_id, name, description, weight, sort_order)
    SELECT target_event, criterion_names[i], criterion_questions[i], criterion_weights[i], i
    FROM generate_subscripts(criterion_names, 1) AS indexes(i);

    UPDATE public.jd_events
    SET results_published = false, reveal_step = 0
    WHERE id = target_event;
  END IF;
END;
$$;
